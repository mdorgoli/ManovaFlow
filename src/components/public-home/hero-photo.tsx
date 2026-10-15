"use client";

import Image from "next/image";
import { useState } from "react";
import styles from "./public-home.module.css";

export function HeroPhoto() {
  const [failed, setFailed] = useState(false);
  return (
    <div className={styles.heroPhoto} aria-hidden="true">
      {!failed && (
        <Image
          src="/assets/home/hero-lifestyle-v1.png"
          alt=""
          fill
          sizes="(max-width: 767px) 32px, (max-width: 1199px) 74vw, 1060px"
          loading="eager"
          fetchPriority="high"
          data-home-photo
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
