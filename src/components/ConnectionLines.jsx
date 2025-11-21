import React from 'react';

function ConnectionLines({ users, positions, activeTags }) {
    // activeTags: { sourceUserId: [targetNickname, ...] }

    const lines = [];

    // Helper to find intersection with tile rectangle
    const getIntersection = (x1, y1, x2, y2) => {
        const w = 200;
        const h = 150;
        const dx = x2 - x1;
        const dy = y2 - y1;

        if (dx === 0 && dy === 0) return { x: x1, y: y1 };

        // Calculate intersection with all 4 sides
        // Side 1: Right (x = x1 + w/2)
        // Side 2: Left (x = x1 - w/2)
        // Side 3: Bottom (y = y1 + h/2)
        // Side 4: Top (y = y1 - h/2)

        const slope = dy / dx;

        // Check vertical edges
        if (dx !== 0) {
            const xRight = x1 + w / 2;
            const yRight = y1 + slope * (xRight - x1);
            if (dx > 0 && Math.abs(yRight - y1) <= h / 2) return { x: xRight, y: yRight };

            const xLeft = x1 - w / 2;
            const yLeft = y1 + slope * (xLeft - x1);
            if (dx < 0 && Math.abs(yLeft - y1) <= h / 2) return { x: xLeft, y: yLeft };
        }

        // Check horizontal edges
        if (dy !== 0) {
            const invSlope = dx / dy;
            const yBottom = y1 + h / 2;
            const xBottom = x1 + invSlope * (yBottom - y1);
            if (dy > 0 && Math.abs(xBottom - x1) <= w / 2) return { x: xBottom, y: yBottom };

            const yTop = y1 - h / 2;
            const xTop = x1 + invSlope * (yTop - y1);
            if (dy < 0 && Math.abs(xTop - x1) <= w / 2) return { x: xTop, y: yTop };
        }

        return { x: x1, y: y1 };
    };

    Object.entries(activeTags).forEach(([sourceId, tags]) => {
        const sourcePos = positions[sourceId];
        if (!sourcePos) return;

        tags.forEach(targetNickname => {
            const targetUser = users.find(u => u.nickname === targetNickname);
            if (targetUser && positions[targetUser.id]) {
                const targetPos = positions[targetUser.id];

                // Check if target also tagged source (for thicker line)
                const targetTags = activeTags[targetUser.id] || [];
                const sourceUser = users.find(u => u.id === sourceId);
                const isMutual = sourceUser && targetTags.includes(sourceUser.nickname);

                const cx1 = sourcePos.x + 100;
                const cy1 = sourcePos.y + 75;
                const cx2 = targetPos.x + 100;
                const cy2 = targetPos.y + 75;

                const start = getIntersection(cx1, cy1, cx2, cy2);
                const end = getIntersection(cx2, cy2, cx1, cy1);

                lines.push({
                    x1: start.x,
                    y1: start.y,
                    x2: end.x,
                    y2: end.y,
                    strokeWidth: isMutual ? 4 : 1,
                    opacity: 1
                });
            }
        });
    });

    return (
        <svg
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 0
            }}
        >
            {lines.map((line, i) => (
                <line
                    key={i}
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke="var(--primary-color)"
                    strokeWidth={line.strokeWidth}
                    strokeLinecap="round"
                />
            ))}
        </svg>
    );
}

export default ConnectionLines;
