import argparse
import logging
import os
import sys
from feishu_agent.config import get_config


def setup_logging(verbose: bool = False):
    cfg = get_config()
    level = logging.DEBUG if verbose else getattr(logging, cfg.feishu_agent_log_level, logging.INFO)
    log_file = os.path.expanduser(cfg.feishu_agent_log_file)

    os.makedirs(os.path.dirname(log_file), exist_ok=True)

    logging.basicConfig(
        level=level,
        format="%(asctime)s — %(levelname)s — %(name)s — %(message)s",
        handlers=[
            logging.FileHandler(log_file, encoding="utf-8"),
            logging.StreamHandler(sys.stderr),
        ],
    )
    return logging.getLogger("feishu-agent")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="feishu-auto",
        description="飞书 AI Agent — 自动领任务、执行、流转、上报",
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="开启 DEBUG 日志")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list", help="列出所有待领取任务")

    claim = sub.add_parser("claim", help="领取指定任务")
    claim.add_argument("work_item_id", help="工作项 ID")
    claim.add_argument("user_key", nargs="?", default="", help="领取人 user_key（默认从环境变量）")

    run = sub.add_parser("run", help="执行任务")
    run.add_argument("work_item_id", help="工作项 ID")
    run.add_argument("role", nargs="?", default="office-hours", help="gstack 角色（默认 office-hours）")

    flow = sub.add_parser("flow", help="流转到下一节点")
    flow.add_argument("work_item_id", help="工作项 ID")

    report = sub.add_parser("report", help="生成执行报告")
    report.add_argument("work_item_id", help="工作项 ID")
    report.add_argument("--status", "-s", default="success", choices=["success", "partial", "failure", "timeout", "interrupted"])

    auto = sub.add_parser("auto", help="自动模式")
    auto.add_argument("work_item_id", help="工作项 ID")
    auto.add_argument("--yes", "-y", action="store_true", help="全自动模式（无需确认）")
    auto.add_argument("--timeout", "-t", type=int, default=60, help="确认超时秒数（默认 60）")

    return parser


def main():
    args = build_parser().parse_args()
    logger = setup_logging(args.verbose)
    logger.info("feishu-auto 启动，命令: %s", args.command)

    from feishu_agent.orchestrator import Orchestrator
    from feishu_agent.config import get_config

    cfg = get_config()
    orch = Orchestrator()

    try:
        if args.command == "list":
            tasks = orch.list_tasks()
            print(f"找到 {len(tasks)} 个任务:")
            for t in tasks:
                print(f"  - {t}")

        elif args.command == "claim":
            user_key = args.user_key or cfg.feishu_project_user_key
            result = orch.claim_task(args.work_item_id, user_key)
            if result.get("claimed"):
                print(f"✅ 已领取任务 {args.work_item_id}")
            else:
                print(f"❌ 领取失败: {result.get('error')}")
                sys.exit(1)

        elif args.command == "run":
            result = orch.dispatch_to_gstack(args.role, f"任务 {args.work_item_id}")
            if result.get("success"):
                print(f"✅ 执行完成: {result.get('result')}")
            else:
                print(f"❌ 执行失败: {result.get('error')}")
                sys.exit(1)

        elif args.command == "flow":
            result = orch.transition_node(args.work_item_id)
            if result.get("success"):
                print(f"✅ 已流转到 {result.get('target_state')}")
            else:
                print(f"❌ 流转失败: {result.get('error') or result.get('reason')}")
                sys.exit(1)

        elif args.command == "report":
            from feishu_client.mcp import MCPClient, MCPConfig
            mcp_cfg = MCPConfig()
            mcp_cfg.mcp_key = cfg.feishu_project_mcp_key
            mcp_cfg.user_key = cfg.feishu_project_user_key
            mcp_cfg.project_key = cfg.feishu_project_key
            mcp_cfg.project_simple_name = cfg.feishu_project_simple_name
            orch.mcp_client = MCPClient(mcp_cfg)

            report_data = {
                "status": args.status,
                "summary": "手动触发报告",
                "completed": [],
                "exec_data": {},
                "artifacts": [],
                "risks": [],
                "decisions": [],
                "next_action": "—",
            }
            result = orch.generate_report(args.work_item_id, report_data)
            if result.get("success"):
                print(f"✅ 报告已发布到工作项 {args.work_item_id}")
            else:
                print(f"⚠️  报告生成失败: {result.get('error')}")
                print(f"报告内容:\n{result.get('report', '')}")

        elif args.command == "auto":
            from feishu_agent.config import get_config
            cfg_local = get_config()
            logger.info(f"启动自动模式，工作项: {args.work_item_id}")
            result = orch.auto_mode(args.work_item_id, yes=args.yes, confirm_timeout=args.timeout)
            print(f"自动模式完成，共执行 {len(result.get('steps', []))} 步")

    except KeyboardInterrupt:
        logger.warning("用户中断")
        print("\n已中断")
        sys.exit(130)
    except Exception as e:
        logger.exception("执行失败: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
