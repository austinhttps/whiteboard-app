import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  MessageSquare,
  X,
  Send,
  CheckCircle2,
  Trash2,
  User,
  Reply,
} from 'lucide-react';
import { CanvasElement, CommentThread, ThemeMode } from '../../types/whiteboard';

interface CommentThreadModalProps {
  isOpen: boolean;
  onClose: () => void;
  element: CanvasElement | null;
  comments: CommentThread[];
  localUser: { name: string; color: string; id: string };
  onAddComment: (elementId: string, text: string) => void;
  onAddReply: (commentId: string, text: string) => void;
  onDeleteComment: (commentId: string) => void;
  onToggleResolve: (commentId: string) => void;
  theme: ThemeMode;
}

export const CommentThreadModal: React.FC<CommentThreadModalProps> = ({
  isOpen,
  onClose,
  element,
  comments,
  localUser,
  onAddComment,
  onAddReply,
  onDeleteComment,
  onToggleResolve,
  theme,
}) => {
  const [newCommentText, setNewCommentText] = useState('');
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const repliesEndRef = useRef<HTMLDivElement>(null);
  const isDark = theme === 'dark';

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        commentInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !element) return null;

  const elementComments = comments.filter((c) => c.elementId === element.id);
  const unresolvedCount = elementComments.filter((c) => !c.resolved).length;

  const handleSendComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCommentText.trim()) return;

    onAddComment(element.id, newCommentText.trim());
    setNewCommentText('');
    setTimeout(() => {
      repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const handleSendReply = (commentId: string) => {
    if (!replyText.trim()) return;

    onAddReply(commentId, replyText.trim());
    setReplyText('');
    setActiveReplyId(null);
  };

  const formatTimestamp = (timestamp: number) => {
    const diffSeconds = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSeconds < 60) return 'just now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const elementLabel = element.type.charAt(0).toUpperCase() + element.type.slice(1);

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className={`w-full max-w-md rounded-3xl shadow-2xl border flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150 overflow-hidden ${
          isDark
            ? 'bg-slate-900 border-slate-700/80 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-5 py-3.5 border-b ${
            isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold">Comments</h3>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  {elementLabel}
                </span>
              </div>
              <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {elementComments.length === 0
                  ? 'No comments yet'
                  : `${elementComments.length} comment${elementComments.length > 1 ? 's' : ''} (${unresolvedCount} open)`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-full transition-colors ${
              isDark
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Comments Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {elementComments.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
                  isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
                }`}
              >
                <MessageSquare className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold">Start the discussion</p>
              <p className={`text-[11px] mt-1 max-w-[240px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Leave feedback, suggest edits, or ask questions on this {elementLabel.toLowerCase()}.
              </p>
            </div>
          ) : (
            elementComments.map((comment) => {
              const isResolved = comment.resolved;

              return (
                <div
                  key={comment.id}
                  className={`rounded-2xl border p-3.5 transition-all ${
                    isResolved
                      ? isDark
                        ? 'bg-slate-950/40 border-slate-800/60 opacity-60'
                        : 'bg-slate-50 border-slate-200 opacity-60'
                      : isDark
                      ? 'bg-slate-800/60 border-slate-700/60'
                      : 'bg-white border-slate-200 shadow-sm'
                  }`}
                >
                  {/* Comment Author & Actions */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                        style={{ backgroundColor: comment.authorColor || '#6366f1' }}
                      >
                        {comment.author ? comment.author.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
                      </div>
                      <div>
                        <span className="text-xs font-semibold">{comment.author}</span>
                        <span className={`text-[10px] ml-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {formatTimestamp(comment.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Resolve toggle button */}
                      <button
                        onClick={() => onToggleResolve(comment.id)}
                        className={`p-1 rounded-lg transition-colors text-xs flex items-center gap-1 ${
                          isResolved
                            ? 'text-emerald-400 hover:text-emerald-300'
                            : isDark
                            ? 'text-slate-400 hover:text-emerald-400'
                            : 'text-slate-500 hover:text-emerald-600'
                        }`}
                        title={isResolved ? 'Mark as Unresolved' : 'Mark as Resolved'}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {isResolved && <span className="text-[10px] font-medium">Resolved</span>}
                      </button>

                      {/* Delete comment */}
                      <button
                        onClick={() => onDeleteComment(comment.id)}
                        className={`p-1 rounded-lg transition-colors ${
                          isDark
                            ? 'text-slate-500 hover:text-red-400'
                            : 'text-slate-400 hover:text-red-600'
                        }`}
                        title="Delete comment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Comment Body */}
                  <p className={`text-xs whitespace-pre-wrap leading-relaxed ${isResolved ? 'line-through' : ''}`}>
                    {comment.text}
                  </p>

                  {/* Threaded Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-3 space-y-2 pl-3 border-l-2 border-indigo-500/30">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="text-xs">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <div
                              className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                              style={{ backgroundColor: reply.authorColor || '#6366f1' }}
                            >
                              {reply.author.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-[11px]">{reply.author}</span>
                            <span className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                              {formatTimestamp(reply.createdAt)}
                            </span>
                          </div>
                          <p className={`pl-5 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            {reply.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Inline Reply Input / Trigger */}
                  <div className="mt-2.5 pt-2 border-t border-slate-700/30 flex items-center justify-between">
                    {activeReplyId === comment.id ? (
                      <div className="w-full mt-1">
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSendReply(comment.id);
                              }
                            }}
                            placeholder={`Reply to ${comment.author}...`}
                            className={`w-full px-2.5 py-1.5 text-xs rounded-xl outline-none border focus:border-indigo-500 transition-colors ${
                              isDark
                                ? 'bg-slate-950 border-slate-700 text-white'
                                : 'bg-slate-50 border-slate-300 text-slate-900'
                            }`}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSendReply(comment.id)}
                            className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow transition-colors flex-shrink-0"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            setActiveReplyId(null);
                            setReplyText('');
                          }}
                          className={`text-[10px] mt-1 hover:underline ${
                            isDark ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setActiveReplyId(comment.id);
                          setReplyText('');
                        }}
                        className={`text-[11px] font-medium flex items-center gap-1 hover:text-indigo-400 transition-colors ${
                          isDark ? 'text-slate-400' : 'text-slate-600'
                        }`}
                      >
                        <Reply className="w-3 h-3" /> Reply
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={repliesEndRef} />
        </div>

        {/* New Comment Composer */}
        <form
          onSubmit={handleSendComment}
          className={`p-3.5 border-t ${
            isDark ? 'border-slate-800 bg-slate-950/70' : 'border-slate-100 bg-slate-50'
          }`}
        >
          <div className="flex items-start gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5 shadow-sm"
              style={{ backgroundColor: localUser.color }}
            >
              {localUser.name.charAt(0).toUpperCase()}
            </div>

            <div className="flex-1 relative">
              <textarea
                ref={commentInputRef}
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendComment();
                  }
                }}
                placeholder="Write a comment... (Enter to send)"
                rows={2}
                className={`w-full px-3 py-2 text-xs rounded-xl outline-none resize-none border focus:border-indigo-500 transition-colors leading-relaxed ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500'
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>

            <button
              type="submit"
              disabled={!newCommentText.trim()}
              className={`p-2.5 rounded-xl transition-all shadow-md flex-shrink-0 mt-0.5 ${
                newCommentText.trim()
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                  : isDark
                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
              title="Post Comment"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
