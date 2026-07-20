// TableMenuDropdown.jsx
import React, { useState } from 'react';
import { MdTableChart } from 'react-icons/md';
import './TableMenuDropdown.css';

const TableMenuDropdown = ({ editor, setMobileMenuOpen }) => {
  const [showTableMenu, setShowTableMenu] = useState(false);

  return (
    <div className="group table-menu-wrapper">
      <button
        className="icon-button"
        onClick={() => setShowTableMenu(!showTableMenu)}
        title="Table Options"
      >
        <MdTableChart />
      </button>

      {showTableMenu && (
        <div
          className="table-menu"
          onMouseLeave={() => setShowTableMenu(false)}
        >
          <button
            onClick={() => {
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run();
              setShowTableMenu(false);
            }}
            className="table-menu-option"
          >
            Insert Table
          </button>
          <button
            onClick={() => {
              editor.chain().focus().addRowAfter().run();
              setShowTableMenu(false);
            }}
            className="table-menu-option"
          >
            Add Row
          </button>
          <button
            onClick={() => {
              editor.chain().focus().deleteRow().run();
              setShowTableMenu(false);
            }}
            className="table-menu-option"
          >
            Delete Row
          </button>
          <button
            onClick={() => {
              editor.chain().focus().addColumnAfter().run();
              setShowTableMenu(false);
            }}
            className="table-menu-option"
          >
            Add Column
          </button>
          <button
            onClick={() => {
              editor.chain().focus().deleteColumn().run();
              setShowTableMenu(false);
            }}
            className="table-menu-option"
          >
            Delete Column
          </button>
          <button
            onClick={() => {
              editor.chain().focus().deleteTable().run();
              setShowTableMenu(false);
            }}
            className="table-menu-option delete-table"
          >
            Delete Table
          </button>
        </div>
      )}
    </div>
  );
};

export default TableMenuDropdown;