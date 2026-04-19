import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import ClipboardItemCard from "./ClipboardItem";
import Notification from "./Notification";
import ConfirmDialog from "./ConfirmDialog";
import FileTransfer from "./FileTransfer";
import { useClipboard } from "../Hooks/useClipboard";
import { ClipboardItem } from "../types";

interface ClipboardListProps {
  onOpenSettings: () => void;
}

type ViewMode = "all" | "files";

export default function ClipboardList({ onOpenSettings }: ClipboardListProps) {
  const {
    items,
    loading,
    clearAll,
    deleteItem,
    selectItem,
    isEnabled,
    toggleMonitoring,
    notification,
    undoLastAction,
    closeNotification,
    confirmation,
    cancelConfirmation,
    nextPage,
    previousPage,
    canGoNext,
    canGoPrevious,
    totalCount,
    currentPage,
    itemsPerPage,
  } = useClipboard();
  const [searchText, setSearchText] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [showFileTransfer, setShowFileTransfer] = useState(false);

  // Separate state for files view
  const [filesItems, setFilesItems] = useState<ClipboardItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesCurrentPage, setFilesCurrentPage] = useState(0);
  const [filesTotalCount, setFilesTotalCount] = useState(0);

  // Separate state for search results
  const [searchItems, setSearchItems] = useState<ClipboardItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchCurrentPage, setSearchCurrentPage] = useState(0);
  const [searchTotalCount, setSearchTotalCount] = useState(0);

  // Load files when switching to files view
  const loadFilesPage = async (page: number) => {
    if (filesLoading) return;
    
    try {
      setFilesLoading(true);
      const [filesHistory, filesCount] = await Promise.all([
        invoke<ClipboardItem[]>("get_clipboard_files_paginated", { 
          offset: page * itemsPerPage, 
          limit: itemsPerPage 
        }),
        invoke<number>("get_clipboard_files_count"),
      ]);
      
      setFilesItems(filesHistory);
      setFilesCurrentPage(page);
      setFilesTotalCount(filesCount);
    } catch (error) {
      console.error("Failed to load files page:", error);
    } finally {
      setFilesLoading(false);
    }
  };

  // Load search results
  const loadSearchPage = async (page: number, query: string) => {
    if (searchLoading || !query.trim()) return;

    try {
      setSearchLoading(true);
      const [searchResults, searchCount] = await Promise.all([
        invoke<ClipboardItem[]>("search_clipboard", {
          query: query,
          offset: page * itemsPerPage,
          limit: itemsPerPage
        }),
        invoke<number>("get_search_count", { query: query }),
      ]);

      setSearchItems(searchResults);
      setSearchCurrentPage(page);
      setSearchTotalCount(searchCount);
    } catch (error) {
      console.error("Failed to search clipboard:", error);
    } finally {
      setSearchLoading(false);
    }
  };

  // Load files when viewMode changes to files
  useEffect(() => {
    if (viewMode === "files") {
      loadFilesPage(0);
    }
  }, [viewMode]);

  // Trigger search when searchText changes
  useEffect(() => {
    if (searchText.trim()) {
      loadSearchPage(0, searchText);
    }
  }, [searchText]);

  // Get the appropriate items and pagination info based on search/view mode
  const isSearching = searchText.trim().length > 0;
  const currentItems = isSearching
    ? searchItems
    : viewMode === "files"
    ? filesItems
    : items;
  const currentLoading = isSearching
    ? searchLoading
    : viewMode === "files"
    ? filesLoading
    : loading;
  const currentPage_display = isSearching
    ? searchCurrentPage
    : viewMode === "files"
    ? filesCurrentPage
    : currentPage;
  const currentTotalCount = isSearching
    ? searchTotalCount
    : viewMode === "files"
    ? filesTotalCount
    : totalCount;

  const filteredItems = currentItems;

  const handleFileAdded = () => {
    setShowFileTransfer(false);
    // Reload the current view
    if (viewMode === "files") {
      loadFilesPage(filesCurrentPage);
    }
    // The useClipboard hook will automatically refresh for "all" view
  };

  // Navigation functions that work for search, files, and all modes
  const handleNextPage = () => {
    if (isSearching) {
      const maxPage = Math.ceil(searchTotalCount / itemsPerPage) - 1;
      if (searchCurrentPage < maxPage) {
        loadSearchPage(searchCurrentPage + 1, searchText);
      }
    } else if (viewMode === "files") {
      const maxPage = Math.ceil(filesTotalCount / itemsPerPage) - 1;
      if (filesCurrentPage < maxPage) {
        loadFilesPage(filesCurrentPage + 1);
      }
    } else {
      nextPage();
    }
  };

  const handlePreviousPage = () => {
    if (isSearching) {
      if (searchCurrentPage > 0) {
        loadSearchPage(searchCurrentPage - 1, searchText);
      }
    } else if (viewMode === "files") {
      if (filesCurrentPage > 0) {
        loadFilesPage(filesCurrentPage - 1);
      }
    } else {
      previousPage();
    }
  };

  const canGoNextPage = isSearching
    ? searchCurrentPage < Math.ceil(searchTotalCount / itemsPerPage) - 1
    : viewMode === "files"
    ? filesCurrentPage < Math.ceil(filesTotalCount / itemsPerPage) - 1
    : canGoNext;

  const canGoPreviousPage = isSearching
    ? searchCurrentPage > 0
    : viewMode === "files"
    ? filesCurrentPage > 0
    : canGoPrevious;
    
  const totalPages_display = Math.ceil(currentTotalCount / itemsPerPage);

  if (loading && viewMode === "all") {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <span>Loading clipboard history...</span>
      </div>
    );
  }

  return (
    <div className="clipboard-list">
      {/* Monitoring Toggle */}
      <div className="monitoring-toggle">
        <button
          className={`toggle-button ${isEnabled ? "enabled" : "disabled"}`}
          onClick={toggleMonitoring}
          title={`Clipboard monitoring is ${
            isEnabled ? "enabled" : "disabled"
          }`}
        >
          <span className="toggle-icon">{isEnabled ? "🔥" : "⭕"}</span>
          <span className="toggle-text">
            {isEnabled ? "Monitoring Active" : "Monitoring Paused"}
          </span>
        </button>
      </div>

      {/* Header with search and action buttons */}
      <div className="list-header">
        <input
          type="text"
          placeholder="🔍 Search clipboard..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="search-input"
        />
        <div className="header-buttons">
          <div className="view-mode-buttons">
            <button
              className={`view-mode-button ${viewMode === "all" ? "active" : ""}`}
              onClick={() => setViewMode("all")}
              title="Show all items"
            >
              All
            </button>
            <button
              className={`view-mode-button ${viewMode === "files" ? "active" : ""}`}
              onClick={() => setViewMode("files")}
              title="Show files only"
            >
              Files
            </button>
          </div>
          <button
            className="file-transfer-button"
            onClick={() => setShowFileTransfer(!showFileTransfer)}
            title="Transfer files"
          >
            📁
          </button>
          {items.length > 0 && (
            <button
              className="clear-all-button"
              onClick={clearAll}
              title="Clear all clipboard items"
            >
              🗑️ Clear All
            </button>
          )}
          <button
            className="settings-button"
            onClick={onOpenSettings}
            title="Open Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Items count and pagination info */}
      {currentItems.length > 0 && (
        <div className="items-count">
          {isSearching ? (
            `Found ${currentTotalCount} ${currentTotalCount === 1 ? 'result' : 'results'} for "${searchText}"`
          ) : (
            `Showing ${currentPage_display * itemsPerPage + 1}-${Math.min((currentPage_display + 1) * itemsPerPage, currentTotalCount)} of ${currentTotalCount} ${viewMode === "files" ? "files" : "items"}`
          )}
        </div>
      )}

      {/* Top Pagination Controls */}
      {totalPages_display > 1 && (
        <div className="pagination-container top">
          <button
            className="pagination-button previous"
            onClick={handlePreviousPage}
            disabled={!canGoPreviousPage || currentLoading}
            title="Previous page"
          >
            ← Previous
          </button>
          <div className="pagination-info">
            Page {currentPage_display + 1} of {totalPages_display}
          </div>
          <button
            className="pagination-button next"
            onClick={handleNextPage}
            disabled={!canGoNextPage || currentLoading}
            title="Next page"
          >
            Next →
          </button>
        </div>
      )}

      {/* File Transfer */}
      {showFileTransfer && (
        <FileTransfer onFileAdded={handleFileAdded} />
      )}

      {/* Clipboard items */}
      <div className="items-container">
        {filteredItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <p className="empty-message">
              {searchText
                ? "No items match your search"
                : isEnabled
                ? "No clipboard history yet. Copy something to get started!"
                : "Clipboard monitoring is paused. Enable it to start collecting clipboard history."}
            </p>
            {searchText && (
              <button
                className="clear-search-button"
                onClick={() => setSearchText("")}
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <>
            {filteredItems.map((item) => (
              <ClipboardItemCard
                key={item.id}
                item={item}
                onDelete={deleteItem}
                onSelect={selectItem}
              />
            ))}
            {/* Bottom Pagination Controls */}
            {totalPages_display > 1 && (
              <div className="pagination-container bottom">
                <button
                  className="pagination-button previous"
                  onClick={handlePreviousPage}
                  disabled={!canGoPreviousPage || currentLoading}
                  title="Previous page"
                >
                  ← Previous
                </button>
                <div className="pagination-info">
                  Page {currentPage_display + 1} of {totalPages_display}
                </div>
                <button
                  className="pagination-button next"
                  onClick={handleNextPage}
                  disabled={!canGoNextPage || currentLoading}
                  title="Next page"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Notification */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          canUndo={notification.canUndo}
          onUndo={undoLastAction}
          onClose={closeNotification}
        />
      )}

      {/* Confirmation Dialog */}
      {confirmation && (
        <ConfirmDialog
          isOpen={confirmation.isOpen}
          title={confirmation.title}
          message={confirmation.message}
          onConfirm={confirmation.onConfirm}
          onCancel={cancelConfirmation}
        />
      )}
    </div>
  );
}
