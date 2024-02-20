import Link from "next/link";
import React from "react";

import styles from "./header.module.scss";

export const Header = () => {
  const PAGES = [
    {
      name: "HOME",
      link: "/",
    },
    {
      name: "ABOUT",
      link: "/about",
    },
    {
      name: "TASKS",
      link: "/tasks",
    },
  ];
  return (
    <>
      <nav>
        <ul className={styles.nav}>
          {PAGES.map((page) => (
            <Link
              href={page.link}
              key={page.name}
              className={styles.navLinkContainer}
            >
              <span>{page.name}</span>
            </Link>
          ))}
        </ul>
      </nav>
    </>
  );
};
