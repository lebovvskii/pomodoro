import cl from "classnames";
import React, { useEffect, useState } from "react";

import styles from "./timer.module.scss";

export const Timer = () => {
  const TIME: number = 15;
  const [isActive, setActive] = useState(false);
  const [time, setTime] = useState(TIME); // потом поменять на глобальное состояние
  const [isPaused, setPaused] = useState(false);

  useEffect(() => {
    let interval: any;

    if (isActive && !isPaused) {
      interval = setInterval(() => {
        setTime((prevTime) => {
          if (prevTime === 0) {
            setActive(false);
            return TIME;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else if (!isActive && !isPaused) {
      setTime(TIME);
    }

    return () => clearInterval(interval);
  }, [isActive, isPaused]);

  const handleStart = () => {
    if (!isActive) {
      setActive(true);
    }
    if (isPaused) {
      setPaused(false);
    }
  };

  const handleStop = () => {
    setActive(false);
    setTime(TIME);
    setPaused(false);
  };

  const handlePause = () => {
    setPaused(!isPaused);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes}:${seconds < 10 ? `0${seconds}` : seconds}`;
  };

  return (
    <>
      <div className={styles.clockContainer}>
        <div className={styles.timerWindow}>
          <span>{formatTime(time)}</span>
        </div>
      </div>
      <div className={cl(styles.timerController)}>
        {isActive && !isPaused ? (
          <button onClick={handlePause}>Pause</button>
        ) : (
          <button onClick={handleStart}>Start</button>
        )}
        <button onClick={handleStop}>Stop</button>
      </div>
    </>
  );
};
