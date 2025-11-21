import React, { useMemo } from 'react';

const RoomTileBackground = ({ seed }) => {
    const shapes = useMemo(() => {
        // Hexagonal Grid Pattern
        const r = 20; // Hexagon radius
        const width = 200;
        const height = 150;

        // Calculate grid dimensions
        const h = r * Math.sqrt(3);
        const cols = Math.ceil(width / (r * 1.5)) + 1;
        const rows = Math.ceil(height / h) + 1;

        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = ((hash << 5) - hash) + seed.charCodeAt(i);
            hash |= 0;
        }
        const random = () => {
            const x = Math.sin(hash++) * 10000;
            return x - Math.floor(x);
        };

        const items = [];

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const xOffset = (col * r * 1.5);
                const yOffset = (row * h) + (col % 2 === 1 ? h / 2 : 0);

                // Randomly omit some hexes for a "decayed" look
                if (random() > 0.7) continue;

                const opacity = 0.05 + random() * 0.1;

                // Hexagon points
                const points = [];
                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i;
                    const px = xOffset + r * Math.cos(angle);
                    const py = yOffset + r * Math.sin(angle);
                    points.push(`${px},${py}`);
                }

                items.push(
                    <polygon
                        key={`${row}-${col}`}
                        points={points.join(' ')}
                        fill="none"
                        stroke="rgba(0, 210, 255, 0.3)" // Cyan accent
                        strokeWidth="1"
                        style={{ opacity }}
                    />
                );
            }
        }
        return items;
    }, [seed]);

    return (
        <svg
            width="100%"
            height="100%"
            viewBox="0 0 200 150"
            style={{ position: 'absolute', top: 0, left: 0, zIndex: 0, pointerEvents: 'none' }}
        >
            {shapes}
        </svg>
    );
};

export default RoomTileBackground;
