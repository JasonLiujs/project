import argparse
import logging
import sys


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

    run_cmd = sub.add_parser("run", help="执行任务")
    run_cmd.add_argument("work_item_id", help="工作项 ID")

    flow = sub.add_parser("flow", help="流转到下一节点")
    flow.add_argument("work_item_id", help="工作项 ID")

    report = sub.add_parser("report", help="生成执行报告")
    report.add_argument("work_item_id", help="工作项 ID")

    auto = sub.add_parser("auto", help="自动模式")
    auto.add_argument("--yes", "-y", action="store_true", help="全自动模式（无需确认）")

    return parser


def main():
    args = build_parser().parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s — %(levelname)s — %(message)s",
    )

    from feishu_agent.orchestrator import Orchestrator
    orch = Orchestrator()

    try:
        if args.command == "list":
            tasks = orch.list_tasks()
            print(f"找到 {len(tasks)} 个任务:")
            for t in tasks:
                print(f"  - {t}")

        elif args.command == "claim":
            result = orch.claim_task(args.work_item_id, "")
            print(result)

        elif args.command == "run":
            result = orch.dispatch_to_gstack("office-hours", f"任务 {args.work_item_id}")
            print(result)

        elif args.command == "flow":
            result = orch.transition_node(args.work_item_id)
            print(result)

        elif args.command == "report":
            report_data = {
                "status": "success",
                "summary": "手动触发报告",
                "completed": [],
                "exec_data": {},
                "artifacts": [],
                "risks": [],
                "decisions": [],
                "next_action": "—",
            }
            result = orch.generate_report(args.work_item_id, report_data)
            print(result)

        elif args.command == "auto":
            print("启动自动模式...")
            result = orch.auto_mode(args.work_item_id, yes=args.yes)
            print(result)

    except KeyboardInterrupt:
        print("\n已中断")
        sys.exit(130)
    except Exception as e:
        logging.error("执行失败: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
