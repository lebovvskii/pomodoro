import Link from "next/link";
import React from "react";

import styles from "./header.module.scss";

export const Header = () => (
  <nav>
    <ul className={styles.nav}>
      <li className={styles.navLinkContainer}>
        <Link href="/" className={styles.navLink}>
          HOME
        </Link>
      </li>
      <li className={styles.navLinkContainer}>
        <Link href="/about" className={styles.navLink}>
          ABOUT
        </Link>
      </li>
      <li className={styles.navLinkContainer}>
        <Link href="/tasks" className={styles.navLink}>
          TASKS
        </Link>
      </li>
    </ul>
  </nav>
);
