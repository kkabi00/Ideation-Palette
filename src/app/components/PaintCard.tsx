import { Type, Image, Music, Layers2, Lightbulb, User, GitFork, Play, Video } from "lucide-react";
import { Badge } from "./ui/badge";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { useState } from "react";
import { X, Plus, Check } from "lucide-react";

export type PaintType = "text" | "image" | "audio" | "video";
export type PaintSource = "user" | "ai";

export interface Paint {
  id: string;
  title: string;
  type: PaintType;
  content: string;
  source: PaintSource;
  tags: string[];
  timestamp: string;
  description?: string;
  derivedFrom?: string[];
  pinned?: boolean;
  cluster?: string;
  paintKind?: "explicit" | "implicit" | "bridge";
  imageUrl?: string;
  audioWaveform?: number[];
  x?: number;
  y?: number;
}

interface PaintCardProps {
  paint: Paint;
  size?: "compact" | "small" | "medium" | "large";
  isSelected?: boolean;
  isDragging?: boolean;
  isCombineTarget?: boolean;
  onClick?: () => void;
  onUpdate?: (id: string, updates: Partial<Paint>) => void;
  isEditing?: boolean;
}

export function PaintCard({
  paint,
  size = "medium",
  isSelected = false,
  isDragging = false,
  isCombineTarget = false,
  onClick,
  onUpdate,
  isEditing = false,
}: PaintCardProps) {
  const [localContent, setLocalContent] = useState(paint.content);
  const [localTags, setLocalTags] = useState(paint.tags);
  const [newTag, setNewTag] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(paint.title);

  const handleContentBlur = () => {
    if (onUpdate && localContent !== paint.content) {
      onUpdate(paint.id, { content: localContent });
    }
  };

  const handleTitleBlur = () => {
    if (onUpdate && localTitle !== paint.title) {
      onUpdate(paint.id, { title: localTitle });
    }
    setEditingTitle(false);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !localTags.includes(newTag.trim())) {
      const updatedTags = [...localTags, newTag.trim()];
      setLocalTags(updatedTags);
      if (onUpdate) {
        onUpdate(paint.id, { tags: updatedTags });
      }
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updatedTags = localTags.filter((t) => t !== tagToRemove);
    setLocalTags(updatedTags);
    if (onUpdate) {
      onUpdate(paint.id, { tags: updatedTags });
    }
  };

  if (size === "compact") {
    return (
      <div
        onClick={onClick}
        className={`bg-white rounded-xl border transition-all cursor-pointer ${
          isSelected
            ? "border-blue-400 bg-blue-50/50 shadow-sm"
            : "border-gray-200 hover:border-gray-300"
        } w-full p-3`}
      >
        <div className="flex items-start gap-3">
          <PaintTypeIcon type={paint.type} />
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <input
                type="text"
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleTitleBlur();
                  }
                  if (e.key === 'Escape') {
                    setLocalTitle(paint.title);
                    setEditingTitle(false);
                  }
                }}
                className="text-sm text-gray-900 w-full p-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
                autoFocus
              />
            ) : (
              <h4 
                className="text-sm text-gray-900 truncate cursor-text" 
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (onUpdate) {
                    setEditingTitle(true);
                  }
                }}
              >
                {paint.title}
              </h4>
            )}
            <p className="text-xs text-gray-500 truncate mt-0.5">{paint.content}</p>
            {paint.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {paint.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {paint.derivedFrom && paint.derivedFrom.length > 0 && (
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100">
            <GitFork className="w-3 h-3 text-blue-400" />
            <span className="text-[10px] text-blue-500">파생됨</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border-2 transition-all cursor-pointer overflow-hidden ${
        isCombineTarget
          ? "border-blue-400 bg-blue-50/30 shadow-lg ring-2 ring-blue-200"
          : isSelected
          ? "border-blue-500 shadow-lg"
          : "border-gray-200 hover:border-gray-300 hover:shadow-md"
      } ${isDragging ? "opacity-60 scale-95" : ""} w-64`}
    >
      {/* Multimodal media preview */}
      <MediaPreview paint={paint} />

      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <PaintTypeIcon type={paint.type} />
            <span className="text-xs text-gray-500 uppercase tracking-wide">
              {paint.type}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {paint.derivedFrom && paint.derivedFrom.length > 0 && (
              <User className="w-3.5 h-3.5 text-purple-500" />
            )}
            {paint.source === "ai" && !paint.derivedFrom && <Lightbulb className="w-3.5 h-3.5 text-yellow-500" />}
            {paint.source === "user" && <User className="w-3.5 h-3.5 text-gray-400" />}
          </div>
        </div>

        {editingTitle ? (
          <input
            type="text"
            value={localTitle}
            onChange={(e) => setLocalTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleTitleBlur();
              }
              if (e.key === 'Escape') {
                setLocalTitle(paint.title);
                setEditingTitle(false);
              }
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-gray-900 mb-1.5 w-full p-1 border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
            autoFocus
          />
        ) : (
          <h3 
            className="text-sm text-gray-900 mb-1.5 line-clamp-2 cursor-text" 
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (onUpdate) {
                setEditingTitle(true);
              }
            }}
          >
            {paint.title}
          </h3>
        )}

        {/* Editable Content */}
        {isEditing ? (
          <textarea
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            onBlur={handleContentBlur}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="w-full text-xs text-gray-600 mb-2 p-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[60px] resize-none"
            placeholder="Add notes..."
          />
        ) : paint.type === "text" ? (
          <p className="text-xs text-gray-600 mb-2 line-clamp-2">{paint.content}</p>
        ) : (
          <p className="text-xs text-gray-500 mb-2 line-clamp-1">{paint.content}</p>
        )}

        {/* Editable Tags */}
        <div className="flex flex-wrap gap-1 items-center">
          {localTags.map((tag) => (
            <div
              key={tag}
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                isEditing
                  ? "bg-blue-100 text-blue-700 flex items-center gap-1"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {tag}
              {isEditing && (
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTag(tag);
                  }}
                  className="hover:text-blue-900"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
          {isEditing && (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                placeholder="+ tag"
                className="w-16 text-[10px] px-1.5 py-0.5 border border-blue-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              {newTag && (
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddTag();
                  }}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {paint.derivedFrom && paint.derivedFrom.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100">
            <GitFork className="w-3 h-3 text-blue-400" />
            <span className="text-[10px] text-blue-500">
              파생: {paint.derivedFrom.join(" + ")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function MediaPreview({ paint }: { paint: Paint }) {
  if (paint.type === "image" && paint.imageUrl) {
    return (
      <div className="w-full h-32 bg-gray-100 relative overflow-hidden">
        <ImageWithFallback
          src={paint.imageUrl}
          alt={paint.title}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  if (paint.type === "video" && paint.imageUrl) {
    return (
      <div className="w-full h-32 bg-gray-900 relative overflow-hidden">
        <ImageWithFallback
          src={paint.imageUrl}
          alt={paint.title}
          className="w-full h-full object-cover opacity-70"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
            <Play className="w-4 h-4 text-gray-900 ml-0.5" />
          </div>
        </div>
        <div className="absolute bottom-2 right-2 bg-black/60 rounded px-1.5 py-0.5 text-[10px] text-white">
          0:34
        </div>
      </div>
    );
  }

  if (paint.type === "audio") {
    const waveform = paint.audioWaveform || generateWaveform();
    return (
      <div className="w-full h-20 bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-3 flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-2">
          <button className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center shrink-0 hover:bg-blue-600 transition-colors">
            <Play className="w-3 h-3 text-white ml-0.5" />
          </button>
          <div className="flex items-end gap-[2px] flex-1 h-8">
            {waveform.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-full bg-blue-400/60 min-w-[2px]"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px] text-gray-400 px-9">
          <span>0:00</span>
          <span>2:14</span>
        </div>
      </div>
    );
  }

  return null;
}

function generateWaveform(): number[] {
  const bars = 28;
  return Array.from({ length: bars }, (_, i) => {
    const center = bars / 2;
    const dist = Math.abs(i - center) / center;
    return Math.max(15, Math.round((1 - dist * 0.6) * 80 + Math.sin(i * 1.2) * 20));
  });
}

function PaintTypeIcon({ type }: { type: PaintType }) {
  const icons = {
    text: Type,
    image: Image,
    audio: Music,
    video: Video,
  };
  const colors = {
    text: "bg-gray-100 text-gray-600",
    image: "bg-emerald-50 text-emerald-600",
    audio: "bg-blue-50 text-blue-600",
    video: "bg-rose-50 text-rose-600",
  };
  const Icon = icons[type];
  return (
    <div className={`w-6 h-6 rounded-md flex items-center justify-center ${colors[type]}`}>
      <Icon className="w-3.5 h-3.5" />
    </div>
  );
}