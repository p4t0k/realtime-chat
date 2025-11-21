import React, { useState, useEffect } from 'react';

const themes = {
    cyberpunk: {
        name: 'Cyberpunk',
        colors: {
            '--bg-color': '#0a0a0a',
            '--text-color': '#e0e0e0',
            '--primary-color': '#00ff9d',
            '--secondary-color': '#ff00ff',
            '--accent-color': '#00d2ff',
            '--tile-bg': '#1a1a1a',
            '--tile-border': '#333',
            '--chatroom-bg': 'radial-gradient(circle at center, #111 0%, #000 100%)',
            '--user-tile-bg': 'rgba(20, 20, 20, 0.8)',
            '--icon-color': '#ffffff'
        }
    },
    midnight: {
        name: 'Midnight',
        colors: {
            '--bg-color': '#050510',
            '--text-color': '#d0d0ff',
            '--primary-color': '#7000ff',
            '--secondary-color': '#ff00aa',
            '--accent-color': '#0088ff',
            '--tile-bg': '#101020',
            '--tile-border': '#2a2a40',
            '--chatroom-bg': 'radial-gradient(circle at center, #101025 0%, #050510 100%)',
            '--user-tile-bg': 'rgba(16, 16, 32, 0.8)',
            '--icon-color': '#ffffff'
        }
    },
    matrix: {
        name: 'Matrix',
        colors: {
            '--bg-color': '#000000',
            '--text-color': '#00ff00',
            '--primary-color': '#00ff00',
            '--secondary-color': '#008800',
            '--accent-color': '#ccffcc',
            '--tile-bg': '#001100',
            '--tile-border': '#003300',
            '--chatroom-bg': '#000000',
            '--user-tile-bg': 'rgba(0, 17, 0, 0.8)',
            '--icon-color': '#ffffff'
        }
    },
    light: {
        name: 'Light',
        colors: {
            '--bg-color': '#f0f0f0',
            '--text-color': '#1a1a1a',
            '--primary-color': '#666666', // Grey
            '--secondary-color': '#888888',
            '--accent-color': '#444444',
            '--tile-bg': '#ffffff',
            '--tile-border': '#ccc',
            '--chatroom-bg': '#f0f0f0',
            '--user-tile-bg': 'rgba(255, 255, 255, 0.85)', // Light grey/white
            '--icon-color': '#000000'
        }
    }
};

function ThemeSettings({ isOpen: controlledIsOpen, onToggle }) {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

    const handleToggle = () => {
        if (onToggle) {
            onToggle();
        } else {
            setInternalIsOpen(!internalIsOpen);
        }
    };

    const [currentTheme, setCurrentTheme] = useState(() => {
        const saved = localStorage.getItem('chat_theme');
        return saved === 'neon' ? 'cyberpunk' : (saved || 'cyberpunk');
    });

    useEffect(() => {
        const theme = themes[currentTheme];
        if (theme) {
            Object.entries(theme.colors).forEach(([key, value]) => {
                document.documentElement.style.setProperty(key, value);
            });
            localStorage.setItem('chat_theme', currentTheme);
        }
    }, [currentTheme]);

    return (
        <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            pointerEvents: 'none' // Allow clicks to pass through empty space
        }}>
            <button
                onClick={handleToggle}
                style={{
                    pointerEvents: 'auto', // Re-enable clicks for button
                    padding: '6px 10px',
                    fontSize: '1rem',
                    background: 'var(--tile-bg)',
                    border: '1px solid var(--tile-border)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    color: 'var(--icon-color)',
                    boxShadow: '0 0 5px rgba(0,0,0,0.3)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '32px',
                    height: '32px'
                }}
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
            </button>

            {isOpen && (
                <div style={{
                    marginTop: '10px',
                    background: 'var(--tile-bg)',
                    border: '1px solid var(--tile-border)',
                    borderRadius: '4px',
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    minWidth: '150px',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                    pointerEvents: 'auto' // Re-enable clicks for dropdown
                }}>
                    <h4 style={{ margin: '0 0 8px 0', color: 'var(--text-color)', fontSize: '0.9rem' }}>Select Theme</h4>
                    {Object.entries(themes).map(([key, theme]) => (
                        <button
                            key={key}
                            onClick={() => {
                                setCurrentTheme(key);
                                if (onToggle) {
                                    onToggle(); // Close via parent
                                } else {
                                    setInternalIsOpen(false);
                                }
                            }}
                            style={{
                                textAlign: 'left',
                                padding: '6px 10px',
                                fontSize: '0.85rem',
                                background: currentTheme === key ? 'var(--primary-color)' : 'transparent',
                                color: currentTheme === key ? 'var(--bg-color)' : 'var(--text-color)',
                                border: 'none',
                                borderRadius: '2px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {theme.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ThemeSettings;
