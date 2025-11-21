import React, { useState } from 'react';

function InfoMenu({ isOpen: controlledIsOpen, onToggle }) {
    const [internalIsOpen, setInternalIsOpen] = useState(false);
    const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
    const [activeModal, setActiveModal] = useState(null);

    const handleToggle = () => {
        if (onToggle) {
            onToggle();
        } else {
            setInternalIsOpen(!internalIsOpen);
        }
    };

    const menuItems = [
        { id: 'about', label: 'About Project' },
        { id: 'docs', label: 'Documentation' },
        { id: 'cookies', label: 'Cookies Consent' }
    ];

    // ... getContent function remains same ...

    const getContent = (id) => {
        switch (id) {
            case 'about':
                return (
                    <div>
                        <h2 style={{ color: 'var(--primary-color)', marginTop: 0 }}>About Project</h2>
                        <p>This is an anonymous realtime chat application designed to be open-minded and free.</p>
                        <p><strong>Rules:</strong></p>
                        <ul style={{ paddingLeft: '20px' }}>
                            <li>Behave politely.</li>
                            <li>Do not insult other people.</li>
                            <li>No racism.</li>
                            <li>No predatory behavior.</li>
                            <li>Do not do anything illegal.</li>
                        </ul>
                        <p>Let's keep this space safe and fun for everyone!</p>
                    </div>
                );
            case 'docs':
                return (
                    <div>
                        <h2 style={{ color: 'var(--primary-color)', marginTop: 0 }}>Documentation</h2>
                        <h3 style={{ fontSize: '1rem', color: 'var(--secondary-color)' }}>How it works</h3>
                        <p><strong>1. Pick a Nickname:</strong> Enter a nickname of at least 4 characters. This is how others will see you.</p>
                        <p><strong>2. Join or Create a Room:</strong> Browse the list of active rooms or create your own. Rooms have a limit of 10 users.</p>
                        <p><strong>3. Chatting:</strong>
                            <ul style={{ paddingLeft: '20px', marginTop: '5px' }}>
                                <li>Type your message and press Enter.</li>
                                <li>Use <strong>#nickname</strong> to tag someone.</li>
                                <li>Hover over tiles to bring them to the front.</li>
                                <li>Click a user's tile to quickly tag them.</li>
                            </ul>
                        </p>
                        <p><strong>4. Settings:</strong> Use the gear icon to change color themes.</p>
                    </div>
                );
            case 'cookies':
                return (
                    <div>
                        <h2 style={{ color: 'var(--primary-color)', marginTop: 0 }}>Cookies Consent</h2>
                        <p>By using this application, you automatically give consent to use all necessary cookies.</p>
                        <p>These cookies are used to:</p>
                        <ul style={{ paddingLeft: '20px' }}>
                            <li>Remember your theme preferences.</li>
                            <li>Maintain your session.</li>
                            <li>Ensure the application functions correctly.</li>
                        </ul>
                        <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>No personal data is sold to third parties.</p>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <>
            <div style={{
                position: 'absolute',
                top: '20px',
                right: '70px', // Positioned to the left of ThemeSettings (which is at right: 20px + ~40px width)
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
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
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
                        {menuItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setActiveModal(item.id);
                                    if (onToggle) {
                                        onToggle();
                                    } else {
                                        setInternalIsOpen(false);
                                    }
                                }}
                                style={{
                                    textAlign: 'left',
                                    padding: '6px 10px',
                                    fontSize: '0.85rem',
                                    background: 'transparent',
                                    color: 'var(--text-color)',
                                    border: 'none',
                                    borderRadius: '2px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={(e) => e.target.style.background = 'transparent'}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {activeModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(5px)',
                    zIndex: 2000,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center'
                }} onClick={() => setActiveModal(null)}>
                    <div style={{
                        background: 'var(--tile-bg)',
                        border: '1px solid var(--primary-color)',
                        borderRadius: '8px',
                        padding: '2rem',
                        maxWidth: '500px',
                        width: '90%',
                        maxHeight: '80vh',
                        overflowY: 'auto',
                        position: 'relative',
                        boxShadow: '0 0 30px rgba(0,0,0,0.5)',
                        color: 'var(--text-color)'
                    }} onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setActiveModal(null)}
                            style={{
                                position: 'absolute',
                                top: '10px',
                                right: '10px',
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-color)',
                                fontSize: '1.5rem',
                                cursor: 'pointer',
                                padding: '5px',
                                lineHeight: 1
                            }}
                        >
                            &times;
                        </button>
                        {getContent(activeModal)}
                    </div>
                </div>
            )}
        </>
    );
}

export default InfoMenu;
