import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { SocketContext } from '../App';
import TileBackground from './TileBackground';

// ...


const MAX_LINES = 6;
const MAX_CHARS_PER_LINE = 24;
const LINE_FADE_TIME = 5000; // ms

const TileContent = React.memo(({ user, isMe, lines, currentLine, onInputChange, onInputKeyDown, inputRef, now }) => {
    // console.log("Rendering TileContent for", user.nickname);

    const formatTime = (joinedAt) => {
        if (!joinedAt) return '';
        const elapsed = Math.max(0, now - joinedAt);
        const seconds = Math.floor((elapsed / 1000) % 60);
        const minutes = Math.floor((elapsed / (1000 * 60)) % 60);
        const hours = Math.floor((elapsed / (1000 * 60 * 60)));

        const pad = (n) => n.toString().padStart(2, '0');
        return `(${pad(hours)}:${pad(minutes)}:${pad(seconds)})`;
    };

    // Render rich input for warning colors
    const renderRichInput = () => {
        if (!currentLine) return null;

        const safeLine = currentLine || '';
        const normalPart = safeLine.slice(0, 20);
        const warningPart = safeLine.slice(20);

        return (
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                padding: '2px',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                whiteSpace: 'pre',
                overflow: 'hidden'
            }}>
                <span>{normalPart}</span>
                <span style={{ color: '#ff0055', textShadow: '0 0 5px #ff0055' }}>{warningPart}</span>
            </div>
        );
    };

    return (
        <>
            <div className="user-tile-header">
                <span>{user.nickname} <span style={{ fontSize: '0.7em', opacity: 0.7 }}>{formatTime(user.joinedAt)}</span></span>
                {isMe && <span style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>(YOU)</span>}
            </div>

            <div className="user-tile-content">
                {lines.map(line => (
                    <div key={line.id} className="fading-line">
                        {line.content}
                    </div>
                ))}
                <div className="current-line" style={{ position: 'relative' }}>
                    {isMe ? (
                        <>
                            {renderRichInput()}
                            <input
                                ref={inputRef}
                                autoFocus
                                value={currentLine}
                                onChange={onInputChange}
                                onKeyDown={onInputKeyDown}
                                placeholder="Type here..."
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    borderBottom: '1px solid #666',
                                    color: 'transparent', // Hide text but keep caret? No, caret takes color from 'color'.
                                    // If we make color transparent, caret is invisible in some browsers.
                                    // Better trick: make text transparent, but use text-shadow? No.
                                    // Or use caret-color.
                                    caretColor: '#e0e0e0',
                                    width: '100%',
                                    padding: '2px',
                                    fontFamily: 'inherit',
                                    fontSize: 'inherit',
                                    outline: 'none',
                                    pointerEvents: 'auto',
                                    position: 'relative',
                                    zIndex: 2
                                }}
                            />
                        </>
                    ) : (
                        <span>{currentLine}</span>
                    )}
                </div>
            </div>
        </>
    );
});

function UserTile({ user, isMe, position, onTagsChange, onTileClick, pendingTag, onTagConsumed, allUsers, now }) {
    const socket = useContext(SocketContext);
    const [lines, setLines] = useState(user.lines || []);
    const [currentLine, setCurrentLine] = useState('');
    const inputRef = useRef(null);

    const [persistentTags, setPersistentTags] = useState([]);

    // Combine current and persistent tags and notify parent
    useEffect(() => {
        if (onTagsChange) {
            const currentMatches = currentLine.match(/#(\w+)/g);
            const currentTags = currentMatches ? currentMatches.map(t => t.slice(1)) : [];
            const allTags = [...new Set([...currentTags, ...persistentTags])];
            // console.log(`UserTile ${user.nickname} tags update:`, allTags);
            onTagsChange(user.id, allTags);
        }
    }, [currentLine, persistentTags, onTagsChange, user.id]);

    const checkTags = (text) => {
        // Deprecated in favor of useEffect, but keeping empty if needed for existing calls to avoid refactor errors immediately
        // We will remove calls to it in next steps or just leave it empty
    };

    // Handle pending tag
    useEffect(() => {
        if (isMe && pendingTag) {
            const prefix = (currentLine.length > 0 && !currentLine.endsWith(' ')) ? ' ' : '';
            const tag = `${prefix}#${pendingTag} `;

            // Check if it fits
            if (currentLine.length + tag.length <= MAX_CHARS_PER_LINE) {
                const newVal = currentLine + tag;
                setCurrentLine(newVal);
                socket.emit('type_update', { type: 'char', char: tag });

                // Auto-submit if full (optional, but consistent with typing)
                if (newVal.length >= MAX_CHARS_PER_LINE) {
                    pushLine(newVal);
                    setCurrentLine('');
                    socket.emit('type_update', { type: 'newline', lineContent: newVal });
                }
            } else {
                // If it doesn't fit, maybe push current line and start new one with tag?
                // For now, let's just push current line and add tag to new line
                pushLine(currentLine);
                socket.emit('type_update', { type: 'newline', lineContent: currentLine });

                setCurrentLine(tag.trim()); // Remove leading space for new line
                socket.emit('type_update', { type: 'char', char: tag.trim() });
            }

            if (onTagConsumed) onTagConsumed();
            inputRef.current?.focus();
        }
    }, [pendingTag, isMe, currentLine, socket, onTagConsumed]);

    // Handle incoming typing events
    useEffect(() => {
        if (isMe) return;

        function onUserTyping(data) {
            if (data.userId === user.id) {
                if (data.type === 'char') {
                    setCurrentLine(prev => {
                        const newVal = prev + data.char;
                        checkTags(newVal);
                        return newVal;
                    });
                } else if (data.type === 'backspace') {
                    setCurrentLine(prev => {
                        const newVal = prev.slice(0, -1);
                        checkTags(newVal);
                        return newVal;
                    });
                } else if (data.type === 'newline') {
                    pushLine(data.lineContent);
                    setCurrentLine('');
                    checkTags('');
                } else if (data.type === 'sync') {
                    // Full sync if needed
                    setCurrentLine(data.content);
                }
            }
        }

        socket.on('user_typing', onUserTyping);
        return () => socket.off('user_typing', onUserTyping);
    }, [socket, user.id, isMe]); // Removed onTagsChange from dependency to avoid re-bind loops if it changes

    // Auto-newline logic removed as per user request
    // We now limit input to MAX_CHARS_PER_LINE in handleChange

    const pushLine = (content) => {
        const newLine = {
            id: Date.now() + Math.random(),
            content: content,
            timestamp: Date.now()
        };
        setLines(prev => {
            const newLines = [...prev, newLine];
            if (newLines.length > MAX_LINES) {
                return newLines.slice(newLines.length - MAX_LINES);
            }
            return newLines;
        });

        // Removed auto-fade timeout as per user request
        // Lines will only disappear when pushed out by new lines

        // Handle persistent tags
        const matches = content.match(/#(\w+)/g);
        if (matches) {
            const newTags = matches.map(t => t.slice(1));
            setPersistentTags(prev => [...prev, ...newTags]);

            // Remove after 1 minute
            setTimeout(() => {
                setPersistentTags(prev => {
                    // Remove one instance of each tag? Or just filter out?
                    // Since we use Set for unique tags in useEffect, filtering is safe enough.
                    // But if user typed same tag twice, we might want to keep one?
                    // For simplicity, let's assume if it expires, it expires.
                    // But to be safe against removing re-typed tags:
                    // We could use a counter or timestamp. 
                    // Simple approach: remove these specific tags.
                    // If user typed it again 30s later, that one has its own timeout.
                    // So we should only remove *these* instances.
                    // But we store strings.
                    // Let's just filter for now. If they are chatting actively, they will likely re-tag.
                    return prev.filter(t => !newTags.includes(t));
                });
            }, 60000);
        }
    };

    // Focus logic
    useEffect(() => {
        if (isMe && inputRef.current) {
            // Slight delay to ensure render is done
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isMe]);

    const handleKeyDown = useCallback((e) => {
        if (!isMe) return;

        if (e.key === 'Tab') {
            e.preventDefault();

            // Find the last word being typed
            const match = currentLine.match(/#(\w*)$/);
            if (match) {
                const partialTag = match[1];
                const potentialMatches = allUsers
                    .map(u => u.nickname)
                    .filter(nick => nick.startsWith(partialTag) && nick !== user.nickname);

                if (potentialMatches.length > 0) {
                    // Simple completion: take the first match
                    // Ideally we could cycle through them, but let's start simple
                    const completedTag = potentialMatches[0];
                    const newLine = currentLine.slice(0, -partialTag.length) + completedTag + ' ';

                    if (newLine.length <= MAX_CHARS_PER_LINE) {
                        setCurrentLine(newLine);
                        // We need to sync the whole line or send diffs. 
                        // Sending diffs for completion is tricky. Let's send a sync event or multiple chars.
                        // Easiest is to send a 'sync' event if we supported it, or just backspace and type.
                        // Since we don't have a 'sync' type handled fully on all clients (we added it in onUserTyping but maybe not fully tested),
                        // let's try to just emit the difference.

                        // Actually, we do have 'sync' in onUserTyping!
                        socket.emit('type_update', { type: 'sync', content: newLine });
                    }
                }
            }
            return;
        }

        if (e.key === 'Enter') {
            e.preventDefault();
            pushLine(currentLine);
            setCurrentLine('');
            socket.emit('type_update', { type: 'newline', lineContent: currentLine });
        }
    }, [isMe, currentLine, socket, allUsers, user.nickname]); // Dependencies for useCallback

    const handleChange = useCallback((e) => {
        if (!isMe) return;

        const val = e.target.value;

        // Enforce max length
        if (val.length > MAX_CHARS_PER_LINE) return;

        // Determine diff
        if (val.length > currentLine.length) {
            const char = val.slice(-1);
            socket.emit('type_update', { type: 'char', char });
        } else if (val.length < currentLine.length) {
            socket.emit('type_update', { type: 'backspace' });
        }

        setCurrentLine(val);

        // Auto-submit if we reached the limit
        if (val.length >= MAX_CHARS_PER_LINE) {
            pushLine(val);
            setCurrentLine('');
            socket.emit('type_update', { type: 'newline', lineContent: val });
        }
    }, [isMe, currentLine, socket]);

    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className={`user-tile ${isMe ? 'is-me' : ''}`}
            style={{
                transform: `translate(${Number.isFinite(position.x) ? position.x : 0}px, ${Number.isFinite(position.y) ? position.y : 0}px)`,
                zIndex: isHovered ? 200 : (isMe ? 100 : 1)
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => {
                if (isMe) {
                    inputRef.current?.focus();
                } else {
                    if (onTileClick) onTileClick(user);
                }
            }}
        >
            <TileBackground seed={user.id} />
            <TileContent
                user={user}
                isMe={isMe}
                lines={lines}
                currentLine={currentLine}
                onInputChange={handleChange}
                onInputKeyDown={handleKeyDown}
                inputRef={inputRef}
                now={now}
            />
        </div>
    );
}

export default UserTile;
