'use client';

import { useState, type ComponentType, type CSSProperties } from 'react';

interface WorkerArtProps {
  label: string;
  Illustration: ComponentType;
  imageSrc?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Prefers the authentic real-world raster at `imageSrc` (e.g. /worker-icons/electrician.webp).
 * Shows the clean SVG until the image loads; on error keeps the SVG.
 */
export function WorkerArt({ Illustration, imageSrc, className, style }: WorkerArtProps) {
  const [rasterOk, setRasterOk] = useState(false);
  const [rasterFailed, setRasterFailed] = useState(!imageSrc);

  return (
    <span className={className} style={{ position: 'relative', display: 'grid', placeItems: 'center', width: '100%', height: '100%', ...style }} aria-hidden="true">
      {!rasterOk && <Illustration />}
      {imageSrc && !rasterFailed && (
        <img
          src={imageSrc}
          alt=""
          width={72}
          height={72}
          loading="lazy"
          decoding="async"
          onLoad={() => setRasterOk(true)}
          onError={() => setRasterFailed(true)}
          style={{
            position: rasterOk ? 'relative' : 'absolute',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 14,
            opacity: rasterOk ? 1 : 0,
            pointerEvents: 'none',
          }}
        />
      )}
    </span>
  );
}
