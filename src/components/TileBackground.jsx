import React, { useMemo } from 'react';

const TileBackground = ({ seed }) => {
    const shapes = useMemo(() => {
        // Jittered Grid Mesh Pattern
        // Smaller pattern -> More columns and rows
        const cols = 8;
        const rows = 6;
        const width = 200;
        const height = 150;
        const padding = 20; // Padding from edges

        const gridW = width - (padding * 2);
        const gridH = height - (padding * 2);

        const cellW = gridW / cols;
        const cellH = gridH / rows;

        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = ((hash << 5) - hash) + seed.charCodeAt(i);
            hash |= 0;
        }
        const random = () => {
            const x = Math.sin(hash++) * 10000;
            return x - Math.floor(x);
        };

        // Generate vertices
        const vertices = [];
        for (let r = 0; r <= rows; r++) {
            const rowPoints = [];
            for (let c = 0; c <= cols; c++) {
                // Base position (offset by padding)
                let x = padding + c * cellW;
                let y = padding + r * cellH;

                // Jitter
                // User wants "spiky on borders", so we allow jitter everywhere, 
                // and maybe even more on edges?
                // "Align to center" -> Keep center relatively stable?

                // Calculate distance from center (normalized 0-1)
                // const cx = c / cols - 0.5;
                // const cy = r / rows - 0.5;
                // const dist = Math.sqrt(cx * cx + cy * cy) * 2; // 0 at center, ~1.4 at corners

                // Jitter amount increases towards edges for "spiky borders"
                // Base jitter
                let jitterScale = 0.6;

                // Increase jitter at borders
                if (r === 0 || r === rows || c === 0 || c === cols) {
                    jitterScale = 1.2; // More spiky at borders
                }

                const jitterX = (random() - 0.5) * cellW * jitterScale;
                const jitterY = (random() - 0.5) * cellH * jitterScale;

                x += jitterX;
                y += jitterY;

                rowPoints.push({ x, y });
            }
            vertices.push(rowPoints);
        }

        const items = [];

        // Create polygons (triangles)
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const p1 = vertices[r][c];
                const p2 = vertices[r][c + 1];
                const p3 = vertices[r + 1][c + 1];
                const p4 = vertices[r + 1][c];

                // Randomly split the quad into two triangles
                // Either p1-p3 or p2-p4 diagonal
                const split = random() > 0.5;

                const opacity = 0.1 + random() * 0.15;

                if (split) {
                    // Triangle 1: p1-p2-p3
                    items.push(
                        <polygon
                            key={`${r}-${c}-1`}
                            points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
                            fill="none"
                            stroke="var(--tile-border)"
                            strokeWidth="1"
                            style={{ opacity }}
                        />
                    );
                    // Triangle 2: p1-p3-p4
                    items.push(
                        <polygon
                            key={`${r}-${c}-2`}
                            points={`${p1.x},${p1.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`}
                            fill="none"
                            stroke="var(--tile-border)"
                            strokeWidth="1"
                            style={{ opacity: opacity * 0.8 }} // Slight variation
                        />
                    );
                } else {
                    // Triangle 1: p1-p2-p4
                    items.push(
                        <polygon
                            key={`${r}-${c}-1`}
                            points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p4.x},${p4.y}`}
                            fill="none"
                            stroke="var(--tile-border)"
                            strokeWidth="1"
                            style={{ opacity }}
                        />
                    );
                    // Triangle 2: p2-p3-p4
                    items.push(
                        <polygon
                            key={`${r}-${c}-2`}
                            points={`${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`}
                            fill="none"
                            stroke="var(--tile-border)"
                            strokeWidth="1"
                            style={{ opacity: opacity * 0.8 }}
                        />
                    );
                }
            }
        }
        return items;
    }, [seed]);

    return (
        <svg
            width="100%"
            height="100%"
            style={{ position: 'absolute', top: 0, left: 0, zIndex: 0, pointerEvents: 'none' }}
        >
            {shapes}
        </svg>
    );
};

export default TileBackground;
