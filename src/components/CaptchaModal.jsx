import React, { useState, useEffect, useRef } from 'react';

function CaptchaModal({ challenge, onVerify, onCancel }) {
    const [answer, setAnswer] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        onVerify(answer);
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(5px)',
            zIndex: 3000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
        }}>
            <div style={{
                background: 'var(--tile-bg)',
                border: '1px solid var(--primary-color)',
                borderRadius: '8px',
                padding: '2rem',
                maxWidth: '400px',
                width: '90%',
                boxShadow: '0 0 30px var(--primary-color)',
                textAlign: 'center',
                color: 'var(--text-color)'
            }}>
                <h2 style={{ marginTop: 0, color: 'var(--primary-color)' }}>Security Check</h2>
                <p>You are performing actions too quickly.</p>
                <p style={{ fontSize: '1.2rem', margin: '20px 0' }}>
                    Please solve this: <strong>{challenge?.question}</strong>
                </p>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input
                        ref={inputRef}
                        type="text" // Keep as text to avoid number spinners
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="Answer"
                        style={{
                            padding: '10px',
                            fontSize: '1.2rem',
                            textAlign: 'center',
                            background: 'rgba(0,0,0,0.2)',
                            border: '1px solid var(--tile-border)',
                            color: 'var(--text-color)',
                            borderRadius: '4px'
                        }}
                    />
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        <button
                            type="button"
                            onClick={onCancel}
                            style={{
                                padding: '10px 20px',
                                background: 'transparent',
                                border: '1px solid var(--tile-border)',
                                color: 'var(--text-color)',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            style={{
                                padding: '10px 20px',
                                background: 'var(--primary-color)',
                                border: 'none',
                                color: 'var(--bg-color)',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            Verify
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CaptchaModal;
