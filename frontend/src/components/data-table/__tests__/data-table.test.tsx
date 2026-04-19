/* Copyright 2026 Marimo. All rights reserved. */
import type {
  ColumnDef,
  PaginationState,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Filter } from "@/components/data-table/filters";
import { DataTable } from "../data-table";

interface TestData {
  id: number;
  name: string;
}

describe("DataTable", () => {
  it("should maintain selection state when remounted", () => {
    const mockOnRowSelectionChange = vi.fn();
    const testData: TestData[] = [
      { id: 1, name: "Test 1" },
      { id: 2, name: "Test 2" },
    ];

    const columns: ColumnDef<TestData>[] = [
      { accessorKey: "name", header: "Name" },
    ];

    const initialRowSelection: RowSelectionState = { "0": true };

    const commonProps = {
      data: testData,
      columns,
      selection: "single" as const,
      totalRows: 2,
      totalColumns: 1,
      pagination: false,
      rowSelection: initialRowSelection,
      onRowSelectionChange: mockOnRowSelectionChange,
    };

    const { rerender } = render(
      <TooltipProvider>
        <DataTable {...commonProps} />
      </TooltipProvider>,
    );

    // Verify initial selection is not cleared
    expect(mockOnRowSelectionChange).not.toHaveBeenCalledWith({});

    // Simulate remount (as would happen in accordion toggle)
    rerender(
      <TooltipProvider>
        <DataTable {...commonProps} />
      </TooltipProvider>,
    );

    // Verify selection is still not cleared after remount
    expect(mockOnRowSelectionChange).not.toHaveBeenCalledWith({});

    // Verify the rowSelection prop is maintained
    expect(commonProps.rowSelection).toEqual(initialRowSelection);
  });

  it("applies hoverTemplate to the row title using row values", () => {
    interface RowData {
      id: number;
      first: string;
      last: string;
    }

    const testData: RowData[] = [
      { id: 1, first: "Michael", last: "Scott" },
      { id: 2, first: "Jim", last: "Halpert" },
    ];

    const columns: ColumnDef<RowData>[] = [
      { accessorKey: "first", header: "First" },
      { accessorKey: "last", header: "Last" },
    ];

    render(
      <TooltipProvider>
        <DataTable
          data={testData}
          columns={columns}
          selection={null}
          totalRows={2}
          totalColumns={2}
          pagination={false}
          hoverTemplate={"{{first}} {{last}}"}
        />
      </TooltipProvider>,
    );

    // Grab all rows and assert title attribute computed from template
    const rows = screen.getAllByRole("row");
    // The first row is header; subsequent rows correspond to data
    expect(rows[1]).toHaveAttribute("title", "Michael Scott");
    expect(rows[2]).toHaveAttribute("title", "Jim Halpert");
  });

  it("does not virtualize small datasets without pagination", () => {
    const testData = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
    }));

    const columns: ColumnDef<TestData>[] = [
      { accessorKey: "id", header: "ID" },
      { accessorKey: "name", header: "Name" },
    ];

    render(
      <TooltipProvider>
        <DataTable
          data={testData}
          columns={columns}
          selection={null}
          totalRows={50}
          totalColumns={2}
          pagination={false}
        />
      </TooltipProvider>,
    );

    // All 50 data rows + 1 header row should be in the DOM (no virtualization)
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(51);
  });

  it("virtualizes large datasets — renders fewer rows than the full dataset", () => {
    const testData = Array.from({ length: 200 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
    }));

    const columns: ColumnDef<TestData>[] = [
      { accessorKey: "id", header: "ID" },
      { accessorKey: "name", header: "Name" },
    ];

    render(
      <TooltipProvider>
        <DataTable
          data={testData}
          columns={columns}
          selection={null}
          totalRows={200}
          totalColumns={2}
          pagination={false}
        />
      </TooltipProvider>,
    );

    // In jsdom the virtualizer sees a 0-height container and renders 0 data
    // rows (no layout engine). The key assertion is that significantly fewer
    // than 200 rows are in the DOM, which catches regressions where
    // virtualization is accidentally disabled and all rows are rendered.
    const rows = screen.getAllByRole("row");
    // Subtract 1 for the header row
    const dataRows = rows.length - 1;
    expect(dataRows).toBeLessThan(200);
  });

  it("should display updated data after rerender with manual sorting and pagination", () => {
    // Simulates the bug from issue #8023:
    // When a user sorts a table, rows that moved from page 2 to page 1
    // don't visually refresh after the underlying data is updated.

    interface RowData {
      id: number;
      status: string;
      value: number;
    }

    // Initial data: 4 rows, page_size=3
    const initialData: RowData[] = [
      { id: 4, status: "pending", value: 40 },
      { id: 3, status: "pending", value: 30 },
      { id: 2, status: "pending", value: 20 },
    ];

    const columns: ColumnDef<RowData>[] = [
      { id: "id", accessorFn: (row) => row.id, header: "id" },
      { id: "status", accessorFn: (row) => row.status, header: "status" },
      { id: "value", accessorFn: (row) => row.value, header: "value" },
    ];

    // Simulate sorted state (value descending) - manual sorting means
    // data comes pre-sorted from backend
    const sorting: SortingState = [{ id: "value", desc: true }];
    const setSorting = vi.fn();

    const paginationState: PaginationState = { pageIndex: 0, pageSize: 3 };
    const setPaginationState = vi.fn();

    const commonProps = {
      columns,
      selection: null as "single" | "multi" | null,
      totalRows: 4,
      totalColumns: 3,
      pagination: true,
      manualPagination: true,
      paginationState,
      setPaginationState,
      manualSorting: true,
      sorting,
      setSorting,
    };

    const { rerender } = render(
      <TooltipProvider>
        <DataTable {...commonProps} data={initialData} />
      </TooltipProvider>,
    );

    // Verify initial data is displayed - look for "pending" in cells
    const rows = screen.getAllByRole("row");
    // Row 0 is header, rows 1-3 are data rows
    expect(rows).toHaveLength(4); // 1 header + 3 data rows
    // All rows should show "pending"
    expect(within(rows[1]).getByText("pending")).toBeTruthy();
    expect(within(rows[2]).getByText("pending")).toBeTruthy();
    expect(within(rows[3]).getByText("pending")).toBeTruthy();

    // Now simulate data update: row with id=4 is now "approved"
    // Backend returns sorted data with the update applied
    const updatedData: RowData[] = [
      { id: 4, status: "approved", value: 40 },
      { id: 3, status: "pending", value: 30 },
      { id: 2, status: "pending", value: 20 },
    ];

    // Rerender with updated data (same sorting, same pagination)
    rerender(
      <TooltipProvider>
        <DataTable {...commonProps} data={updatedData} />
      </TooltipProvider>,
    );

    // BUG: The row should show "approved" but might show stale "pending"
    const updatedRows = screen.getAllByRole("row");
    expect(updatedRows).toHaveLength(4);

    // The first data row (id=4) should now show "approved"
    expect(within(updatedRows[1]).getByText("approved")).toBeTruthy();
    // Other rows should still show "pending"
    expect(within(updatedRows[2]).getByText("pending")).toBeTruthy();
    expect(within(updatedRows[3]).getByText("pending")).toBeTruthy();
  });

  describe("empty state messages", () => {
    it("shows 'No data available' when there is no data and no search/filters", () => {
      const columns: ColumnDef<TestData>[] = [
        { accessorKey: "name", header: "Name" },
      ];

      render(
        <TooltipProvider>
          <DataTable
            data={[]}
            columns={columns}
            selection={null}
            totalRows={0}
            totalColumns={1}
            pagination={false}
          />
        </TooltipProvider>,
      );

      expect(screen.getByText("No data available.")).toBeInTheDocument();
    });

    it("shows 'No results match your search.' when there is a search query but no results", () => {
      const columns: ColumnDef<TestData>[] = [
        { accessorKey: "name", header: "Name" },
      ];

      render(
        <TooltipProvider>
          <DataTable
            data={[]}
            columns={columns}
            selection={null}
            totalRows={0}
            totalColumns={1}
            pagination={false}
            enableSearch={true}
            searchQuery="nonexistent"
          />
        </TooltipProvider>,
      );

      expect(
        screen.getByText("No results match your search."),
      ).toBeInTheDocument();
    });
  });

  describe("selection stability with stable row IDs", () => {
    interface RowDataWithStableId {
      _marimo_row_id: number;
      name: string;
    }

    it("maintains row selection state when using stable row IDs", () => {
      const mockOnRowSelectionChange = vi.fn();
      const testData: RowDataWithStableId[] = [
        { _marimo_row_id: 100, name: "Item A" },
        { _marimo_row_id: 101, name: "Item B" },
        { _marimo_row_id: 102, name: "Item C" },
      ];

      const columns: ColumnDef<RowDataWithStableId>[] = [
        { accessorKey: "name", header: "Name" },
      ];

      const initialRowSelection: RowSelectionState = { "100": true };

      render(
        <TooltipProvider>
          <DataTable
            data={testData}
            columns={columns}
            selection="single"
            totalRows={3}
            totalColumns={1}
            pagination={false}
            rowSelection={initialRowSelection}
            onRowSelectionChange={mockOnRowSelectionChange}
          />
        </TooltipProvider>,
      );

      expect(mockOnRowSelectionChange).not.toHaveBeenCalledWith({});
    });

    it("uses _marimo_row_id as stable row identifier", () => {
      const mockOnRowSelectionChange = vi.fn();
      const testData: RowDataWithStableId[] = [
        { _marimo_row_id: 100, name: "Item A" },
        { _marimo_row_id: 101, name: "Item B" },
      ];

      const columns: ColumnDef<RowDataWithStableId>[] = [
        { accessorKey: "name", header: "Name" },
      ];

      const initialRowSelection: RowSelectionState = { "100": true };

      const { rerender } = render(
        <TooltipProvider>
          <DataTable
            data={testData}
            columns={columns}
            selection="single"
            totalRows={2}
            totalColumns={1}
            pagination={false}
            rowSelection={initialRowSelection}
            onRowSelectionChange={mockOnRowSelectionChange}
          />
        </TooltipProvider>,
      );

      const filteredData: RowDataWithStableId[] = [
        { _marimo_row_id: 100, name: "Item A" },
      ];

      rerender(
        <TooltipProvider>
          <DataTable
            data={filteredData}
            columns={columns}
            selection="single"
            totalRows={1}
            totalColumns={1}
            pagination={false}
            rowSelection={initialRowSelection}
            onRowSelectionChange={mockOnRowSelectionChange}
          />
        </TooltipProvider>,
      );

      expect(mockOnRowSelectionChange).not.toHaveBeenCalledWith({});
      expect(initialRowSelection).toHaveProperty("100", true);
    });

    it("preserves selection when multiple rows are selected before filtering", () => {
      const mockOnRowSelectionChange = vi.fn();
      const testData: RowDataWithStableId[] = [
        { _marimo_row_id: 100, name: "Item A" },
        { _marimo_row_id: 101, name: "Item B" },
        { _marimo_row_id: 102, name: "Item C" },
      ];

      const columns: ColumnDef<RowDataWithStableId>[] = [
        { accessorKey: "name", header: "Name" },
      ];

      const initialRowSelection: RowSelectionState = {
        "100": true,
        "102": true,
      };

      const { rerender } = render(
        <TooltipProvider>
          <DataTable
            data={testData}
            columns={columns}
            selection="multi"
            totalRows={3}
            totalColumns={1}
            pagination={false}
            rowSelection={initialRowSelection}
            onRowSelectionChange={mockOnRowSelectionChange}
          />
        </TooltipProvider>,
      );

      const filteredData: RowDataWithStableId[] = [
        { _marimo_row_id: 100, name: "Item A" },
        { _marimo_row_id: 101, name: "Item B" },
      ];

      rerender(
        <TooltipProvider>
          <DataTable
            data={filteredData}
            columns={columns}
            selection="multi"
            totalRows={2}
            totalColumns={1}
            pagination={false}
            rowSelection={initialRowSelection}
            onRowSelectionChange={mockOnRowSelectionChange}
          />
        </TooltipProvider>,
      );

      expect(mockOnRowSelectionChange).not.toHaveBeenCalledWith({});
      expect(initialRowSelection).toHaveProperty("100", true);
      expect(initialRowSelection).toHaveProperty("102", true);
    });
  });

  describe("reset all functionality", () => {
    it("shows 'Reset all' button when both search and filters are available", () => {
      const mockOnSearchQueryChange = vi.fn();
      const testData: TestData[] = [
        { id: 1, name: "Test 1" },
        { id: 2, name: "Test 2" },
      ];

      const columns: ColumnDef<TestData>[] = [
        { accessorKey: "name", header: "Name" },
      ];

      render(
        <TooltipProvider>
          <DataTable
            data={testData}
            columns={columns}
            selection={null}
            totalRows={2}
            totalColumns={1}
            pagination={false}
            enableSearch={true}
            searchQuery="test"
            onSearchQueryChange={mockOnSearchQueryChange}
            showFilters={true}
            filters={[{ id: "name", value: Filter.text({ text: "test", operator: "contains" }) }]}
          />
        </TooltipProvider>,
      );

      expect(screen.getByText("Reset all")).toBeInTheDocument();
    });

    it("shows 'Clear all' button when only filters are available", () => {
      const testData: TestData[] = [
        { id: 1, name: "Test 1" },
        { id: 2, name: "Test 2" },
      ];

      const columns: ColumnDef<TestData>[] = [
        { accessorKey: "name", header: "Name" },
      ];

      render(
        <TooltipProvider>
          <DataTable
            data={testData}
            columns={columns}
            selection={null}
            totalRows={2}
            totalColumns={1}
            pagination={false}
            showFilters={true}
            filters={[{ id: "name", value: Filter.text({ text: "test", operator: "contains" }) }]}
          />
        </TooltipProvider>,
      );

      expect(screen.getByText("Clear all")).toBeInTheDocument();
    });
  });

  describe("selection without stable row IDs", () => {
    it("uses array index as row ID when _marimo_row_id is not present", () => {
      const mockOnRowSelectionChange = vi.fn();
      const testData: TestData[] = [
        { id: 1, name: "Test 1" },
        { id: 2, name: "Test 2" },
      ];

      const columns: ColumnDef<TestData>[] = [
        { accessorKey: "name", header: "Name" },
      ];

      const initialRowSelection: RowSelectionState = { "0": true };

      const { rerender } = render(
        <TooltipProvider>
          <DataTable
            data={testData}
            columns={columns}
            selection="single"
            totalRows={2}
            totalColumns={1}
            pagination={false}
            rowSelection={initialRowSelection}
            onRowSelectionChange={mockOnRowSelectionChange}
          />
        </TooltipProvider>,
      );

      expect(mockOnRowSelectionChange).not.toHaveBeenCalledWith({});

      const filteredData: TestData[] = [
        { id: 1, name: "Test 1" },
      ];

      rerender(
        <TooltipProvider>
          <DataTable
            data={filteredData}
            columns={columns}
            selection="single"
            totalRows={1}
            totalColumns={1}
            pagination={false}
            rowSelection={initialRowSelection}
            onRowSelectionChange={mockOnRowSelectionChange}
          />
        </TooltipProvider>,
      );

      expect(mockOnRowSelectionChange).not.toHaveBeenCalledWith({});
    });
  });
});
