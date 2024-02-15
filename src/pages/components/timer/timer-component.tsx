import cl from 'classnames'
import { useEffect, useState } from 'react';

import styles from './timer.module.scss'

export const Timer = () => {
  const [isActive, setIsActive] = useState(false);
  const [seconds, setSeconds] = useState(1500);
  useEffect(() => {
    let timer: any
    if (isActive) {
      timer = setInterval(() => {
        setSeconds((seconds) => seconds - 1);
      }, 1000);
    }
    return () => {
      clearInterval(timer);
    };
  });

  return (
    <>
      <div className={cl(styles.clockContainer, styles.test)}>
        <div className={styles.timerWindow}>
          <span>Seconds: {seconds}</span>
        </div>
      </div>
      <div className={cl(styles.timerController)}> 
        <button
          onClick={() => {
            setIsActive(true);
          }}
        >
          Start
        </button>
        <button
          onClick={() => {
            setIsActive(false);
          }}
        >
          Stop
        </button>
      </div>
    </>
  );
}

