import Link from "next/link";
import React from "react";

import styles from "./header.module.scss";

export const Header = () => (
  <nav>
    <ul className={styles.nav}>
      <li className={styles.navLink}>
        <Link href="/">HOME</Link>
      </li>
      <li className={styles.navLink}>
        <Link href="/about">ABOUT</Link>
      </li>
      <li className={styles.navLink}>
        <Link href="/tasks">TASKS</Link>
      </li>
    </ul>
  </nav>
);
