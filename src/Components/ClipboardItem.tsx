import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ClipboardItem } from "../types";

type Props = {
  item: ClipboardItem;
  onDelete: (id: string) => void;
  onSelect: (content: string) => void;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export default function ClipboardItemCard({ item, onDelete, onSelect }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const maxPreviewLength = 80;
  const needsExpansion = item.content.length > maxPreviewLength;
  const truncatedContent = needsExpansion
    ? item.content.substring(0, maxPreviewLength) + "..."
    : item.content;

  const loadFilePreview = async () => {
    if (!item.file_path || isLoadingPreview || filePreview !== null) return;
    
    try {
      setIsLoadingPreview(true);
      const preview = await invoke<string | null>("get_file_preview", { 
        filePath: item.file_path,
        maxLength: 300 
      });
      setFilePreview(preview);
    } catch (error) {
      console.error("Failed to load file preview:", error);
      setFilePreview(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleItemClick = () => {
    if (item.content_type === "file") {
      // For files, expand/collapse and load preview if expanding
      if (!isExpanded) {
        loadFilePreview();
      }
      setIsExpanded(!isExpanded);
      // Also move file to top when clicked
      onSelect(item.content);
    } else {
      // For text/image items, copy to clipboard
      onSelect(item.content);
    }
  };

  const handleFileDownload = async () => {
    if (!item.file_path) return;
    
    try {
      const fileName = item.file_name || "downloaded_file";
      
      // Show save dialog to let user choose location
      const savePath = await invoke<string | null>("show_save_dialog", { 
        suggestedName: fileName 
      });
      
      if (!savePath) {
        console.log("Save dialog cancelled");
        return;
      }
      
      // Get file content
      const fileContent = await invoke<number[]>("get_file_content", { filePath: item.file_path });
      
      // Save to chosen location
      const savedPath = await invoke<string>("save_file_to_path", { 
        content: fileContent, 
        filePath: savePath
      });
      
      console.log("File saved to:", savedPath);
    } catch (error) {
      console.error("Failed to download file:", error);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    // Handle both timestamp formats - HH:MM:SS and full datetime
    if (timestamp.includes(":") && !timestamp.includes("T")) {
      // Format like "14:30:25"
      return timestamp;
    }

    // Try to parse as Unix timestamp (seconds since epoch)
    const unixTimestamp = parseInt(timestamp);
    let date: Date;

    if (!isNaN(unixTimestamp) && unixTimestamp > 1000000000) {
      // If it's a valid Unix timestamp (greater than 1000000000 to distinguish from regular numbers)
      date = new Date(unixTimestamp * 1000); // Convert seconds to milliseconds
    } else {
      // Otherwise try to parse as ISO string or other date format
      date = new Date(timestamp);
    }

    if (isNaN(date.getTime())) {
      return timestamp; // Return as-is if can't parse
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      className={`clipboard-item ${isExpanded ? "expanded" : ""} ${item.content_type === "file" ? "file-item" : ""}`}
      onClick={() => handleItemClick()}
    >
      <div className="item-header">
        <div className="item-icon">
          {item.content_type === "image" ? "🖼️" : 
           item.content_type === "file" ? "📁" : "📝"}
        </div>

        <div className="item-preview">
          {!isExpanded && (
            <div
              className={`item-content-preview ${
                needsExpansion ? "truncated" : ""
              }`}
            >
              {truncatedContent}
            </div>
          )}

          <div className="item-meta">
            <div className="device-info">
              <span className="device-icon">💻</span>
              <span>{item.device}</span>
            </div>
            <span>•</span>
            <span>{formatTimestamp(item.timestamp)}</span>
            {item.content_type === "file" && item.file_size && (
              <>
                <span>•</span>
                <span>{formatFileSize(item.file_size)}</span>
              </>
            )}
            {needsExpansion && (
              <>
                <span>•</span>
                <button
                  className="more-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(!isExpanded);
                  }}
                >
                  {isExpanded ? "Show less" : "Show more"}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="item-actions">
          {!isExpanded && (
            <button
              className="action-button delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              title="Delete item"
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="item-expanded-content">
          <div className="expanded-text">
            {item.content_type === "file" ? (
              <div className="file-preview">
                {isLoadingPreview ? (
                  <div className="preview-loading">Loading preview...</div>
                ) : filePreview ? (
                  <div className="file-text-preview">
                    <div className="preview-label">File Content Preview:</div>
                    <pre className="preview-content">{filePreview}</pre>
                  </div>
                ) : (
                  <div className="no-preview">
                    {item.file_name ? (
                      `📁 ${item.file_name} - No text preview available (binary file or unsupported format)`
                    ) : (
                      "📁 File - No text preview available"
                    )}
                  </div>
                )}
              </div>
            ) : (
              item.content
            )}
          </div>
          <div className="expanded-actions">
            {item.content_type === "file" ? (
              <button
                className="expanded-action-btn download-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleFileDownload();
                }}
              >
                Download
              </button>
            ) : (
              <button
                className="expanded-action-btn copy-button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(item.content);
                }}
              >
                Copy
              </button>
            )}
            <button
              className="expanded-action-btn delete-button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
