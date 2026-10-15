import Image from "next/image";
import Link from "next/link";
import styles from "./public-home.module.css";

export function Brand({
  href = "/",
  label = "ManovaFlow home"
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Link href={href} className={styles.brand} aria-label={label} dir="ltr">
      <Image
        src="/assets/brand/manovaflow-mf.svg"
        alt=""
        width={49}
        height={35}
        unoptimized
      />
      <span>MANOVAFLOW</span>
    </Link>
  );
}
