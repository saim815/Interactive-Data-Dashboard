import { useState, useMemo } from 'react';
import { ColumnInfo } from '../types';
import { Search, Plus, Trash2, Edit2, Check, X, ArrowUp, ArrowDown, Download, AlertCircle } from 'lucide-react';

interface DataGridTableProps {
  data: any[];
  columns: ColumnInfo[];
  onDataUpdate: (newData: any[]) => void;
  onRawTextUpdate: (text: string) => void;
}

export default function DataGridTable({
  data,
  columns,
  onDataUpdate,
  onRawTextUpdate
}: DataGridTableProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortKey, setSortKey] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Editing state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingRowVal, setEditingRowVal] = useState<any | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 8;

  // Sorting columns handler
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // Delete matching row
  const handleDeleteRow = (index: number) => {
    const updated = [...data];
    updated.splice(index, 1);
    onDataUpdate(updated);
    
    // Regenerate CSV rawText representation
    rebuildRawTextFromData(updated);
    
    // Safety check for pagination
    if (Math.ceil(updated.length / pageSize) < currentPage && currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // Cell edit mechanics
  const handleStartEdit = (index: number, row: any) => {
    setEditingIndex(index);
    setEditingRowVal({ ...row });
  };

  const handleEditChange = (colName: string, value: string) => {
    if (!editingRowVal) return;
    
    // Cast value based on column details
    const colMeta = columns.find(c => c.name === colName);
    let castedVal: any = value;
    
    if (colMeta?.type === 'number') {
      castedVal = value === '' ? 0 : Number(value);
      if (isNaN(castedVal)) castedVal = value;
    } else if (colMeta?.type === 'boolean') {
      castedVal = value === 'true';
    }

    setEditingRowVal({
      ...editingRowVal,
      [colName]: castedVal
    });
  };

  const handleSaveRow = (originalIndex: number) => {
    if (!editingRowVal) return;
    const updated = [...data];
    updated[originalIndex] = editingRowVal;
    
    onDataUpdate(updated);
    rebuildRawTextFromData(updated);
    
    setEditingIndex(null);
    setEditingRowVal(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingRowVal(null);
  };

  // Adds a blank default row to edit
  const handleAddRow = () => {
    const defaultRow: any = {};
    columns.forEach(col => {
      if (col.type === 'number') {
        defaultRow[col.name] = 0;
      } else if (col.type === 'boolean') {
        defaultRow[col.name] = false;
      } else {
        defaultRow[col.name] = '';
      }
    });

    const updated = [defaultRow, ...data];
    onDataUpdate(updated);
    rebuildRawTextFromData(updated);
    
    // Switch to editing mode on the first row
    setEditingIndex(0);
    setEditingRowVal({ ...defaultRow });
    setCurrentPage(1);
  };

  // Utility to sync live-modifications back to CSV text representation box
  const rebuildRawTextFromData = (newData: any[]) => {
    if (newData.length === 0) {
      onRawTextUpdate('');
      return;
    }
    const headers = columns.map(c => c.name);
    const lines = [headers.join(',')];
    
    newData.forEach(row => {
      const line = headers.map(header => {
        const val = row[header];
        if (val === null || val === undefined) return '';
        const rawStr = String(val);
        // If it includes commas, double-quote protect it
        if (rawStr.includes(',')) {
          return `"${rawStr}"`;
        }
        return rawStr;
      }).join(',');
      lines.push(line);
    });

    onRawTextUpdate(lines.join('\n'));
  };

  // Exports data into browser as CSV file
  const exportToCSV = () => {
    if (data.length === 0) return;
    const headers = columns.map(c => c.name);
    const lines = [headers.join(',')];
    
    data.forEach(row => {
      const line = headers.map(header => {
        const val = row[header];
        if (val === null || val === undefined) return '';
        const rawStr = String(val);
        if (rawStr.includes(',')) return `"${rawStr}"`;
        return rawStr;
      }).join(',');
      lines.push(line);
    });

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(lines.join('\n'));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `dashboard_data_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Searching, sorting, & parsing pipelines
  const processedData = useMemo(() => {
    let result = [...data];

    // 1. Search filter across all keys
    if (searchTerm.trim() !== '') {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(row => {
        return Object.keys(row).some(key => {
          const val = row[key];
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(lowerSearch);
        });
      });
    }

    // 2. Sorting column data
    if (sortKey) {
      result.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];

        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        } else {
          return sortDirection === 'asc' 
            ? String(valA).localeCompare(String(valB)) 
            : String(valB).localeCompare(String(valA));
        }
      });
    }

    // Attach original index for precise live corrections matching
    return result.map((row) => {
      const originalIndex = data.indexOf(row);
      return { row, originalIndex };
    });
  }, [data, searchTerm, sortKey, sortDirection]);

  // Paginated chunk
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return processedData.slice(startIndex, startIndex + pageSize);
  }, [processedData, currentPage]);

  const totalPages = Math.ceil(processedData.length / pageSize);

  return (
    <div id="data-grid-table" className="flex flex-col h-full bg-white space-y-3">
      
      {/* Top Search & Actions bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
        
        {/* Search Search Box */}
        <div className="relative w-full sm:w-72">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search size={14} />
          </span>
          <input
            id="search-grid-input"
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search cells..."
            className="w-full text-xs py-2 pl-9 pr-4 bg-white text-slate-800 rounded-lg border border-slate-250 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-xs"
          />
        </div>

        {/* Buttons Action bar */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            id="add-row-button"
            onClick={handleAddRow}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
          >
            <Plus size={14} />
            Add New Row
          </button>

          <button
            id="export-csv-button"
            onClick={exportToCSV}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-250 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Grid Table Block */}
      <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold text-[11px] border-b border-slate-200 uppercase tracking-wider">
                {columns.map((col) => (
                  <th
                    key={col.name}
                    onClick={() => handleSort(col.name)}
                    className="py-3 px-4 cursor-pointer select-none hover:bg-slate-150 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>{col.name}</span>
                      {sortKey === col.name ? (
                        sortDirection === 'asc' ? <ArrowUp size={12} className="text-indigo-600" /> : <ArrowDown size={12} className="text-indigo-600" />
                      ) : null}
                    </div>
                  </th>
                ))}
                <th className="py-3 px-4 font-normal text-right w-24">Actions</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {paginatedData.length > 0 ? (
                paginatedData.map(({ row, originalIndex }, pIdx) => {
                  const isEditingThis = editingIndex === originalIndex;

                  return (
                    <tr
                      key={pIdx}
                      className={`hover:bg-slate-50/50 transition-colors ${
                        isEditingThis ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      {columns.map((col) => {
                        const cellVal = row[col.name];

                        return (
                          <td key={col.name} className="py-2.5 px-4 font-medium text-slate-700 max-w-[180px] truncate">
                            {isEditingThis && editingRowVal ? (
                              col.type === 'boolean' ? (
                                <select
                                  value={String(editingRowVal[col.name])}
                                  onChange={(e) => handleEditChange(col.name, e.target.value)}
                                  className="w-full text-xs p-1 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                                >
                                  <option value="true">True</option>
                                  <option value="false">False</option>
                                </select>
                              ) : (
                                <input
                                  type={col.type === 'number' ? 'number' : 'text'}
                                  value={editingRowVal[col.name] !== undefined ? editingRowVal[col.name] : ''}
                                  onChange={(e) => handleEditChange(col.name, e.target.value)}
                                  className="w-full text-xs px-2 py-1 bg-white border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none font-mono"
                                />
                              )
                            ) : (
                              <span className={col.type === 'number' ? 'font-mono font-medium text-slate-800' : 'text-slate-600'}>
                                {cellVal === null || cellVal === undefined
                                  ? <span className="text-slate-300 italic">null</span>
                                  : String(cellVal)
                                }
                              </span>
                            )}
                          </td>
                        );
                      })}

                      {/* Controls cell */}
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isEditingThis ? (
                            <>
                              <button
                                onClick={() => handleSaveRow(originalIndex)}
                                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                                title="Save changes"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="p-1 text-slate-400 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                title="Cancel editing"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleStartEdit(originalIndex, row)}
                                className="p-1 text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-md transition-colors cursor-pointer"
                                title="Edit row"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteRow(originalIndex)}
                                className="p-1 text-slate-450 hover:bg-slate-50 hover:text-red-500 rounded-md transition-colors cursor-pointer"
                                title="Delete row"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={columns.length + 1} className="py-12 text-center text-slate-400 italic">
                    <div className="flex flex-col items-center justify-center space-y-1.5">
                      <AlertCircle size={20} className="text-slate-300" />
                      <p>No matching cell records found matching filter criteria.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination control row */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1 py-1.5 text-xs text-slate-500">
          <span>
            Shown row: <strong>{(currentPage - 1) * pageSize + 1}</strong> to{' '}
            <strong>{Math.min(processedData.length, currentPage * pageSize)}</strong> of{' '}
            <strong>{processedData.length}</strong> records
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1.5 rounded bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-slate-50 border border-slate-200 select-none cursor-pointer transition-colors"
            >
              Previous
            </button>
            <span className="px-3 font-semibold text-slate-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-1.5 rounded bg-slate-50 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-slate-50 border border-slate-200 select-none cursor-pointer transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
