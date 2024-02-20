import cl from "classnames";
import React, { useEffect, useState } from "react";
import { AiOutlineDown, AiOutlineUp } from "react-icons/ai";

import styles from "./timer.module.scss";

export const Timer = () => {
  const TIME: number = 1500;
  const [isActive, setActive] = useState(false);
  const [time, setTime] = useState(TIME); // потом поменять на глобальное состояние
  const [isPaused, setPaused] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line no-undef
    let interval: NodeJS.Timeout;

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
    const formatedTime = {
      minutes,
      seconds,
    };
    return formatedTime;
  };

  const increaseMinutes = () => {
    time < 2700 ? setTime((prev) => prev + 300) : setTime(3000);
  };

  const decreaseMinutes = () => {
    time < 300 ? setTime(0) : setTime((prev) => prev - 300);
  };

  const increaseSeconds = () => {
    time < 2990 ? setTime((prev) => prev + 10) : setTime(3000);
  };

  const decreaseSeconds = () => {
    time < 10 ? setTime(0) : setTime((prev) => prev - 10);
  };

  const { minutes, seconds } = formatTime(time);

  return (
    <>
      <div className={styles.clockContainer}>
        <div className={styles.increaseArrowContainer}>
          <a>
            <AiOutlineUp
              className={cl(styles.increaseMinutes, styles.arrow)}
              onClick={increaseMinutes}
            />
          </a>
          <a>
            <AiOutlineUp
              className={cl(styles.increaseSeconds, styles.arrow)}
              onClick={increaseSeconds}
            />
          </a>
        </div>
        <div className={styles.timerWindow}>
          <span className={(isActive && !isPaused) ? styles.windowIsActive : ''}>
            {minutes < 10 ? `0${minutes}` : minutes}:
            {seconds < 10 ? `0${seconds}` : seconds}
          </span>
        </div>
        <div className={styles.decreaseArrowContainer}>
          <a>
            <AiOutlineDown
              className={cl(styles.decreaseMinutes, styles.arrow)}
              onClick={decreaseMinutes}
            />
          </a>
          <a>
            <AiOutlineDown
              className={cl(styles.decreaseSeconds, styles.arrow)}
              onClick={decreaseSeconds}
            />
          </a>
        </div>
      </div>
      <div className={styles.timerController}>
        {isActive && !isPaused ? (
          <button onClick={handlePause} className={styles.controllerButton}>
            Pause
          </button>
        ) : (
          <button onClick={handleStart} className={styles.controllerButton}>
            Start
          </button>
        )}
        <button onClick={handleStop} className={styles.controllerButton}>
          Stop
        </button>
      </div>
    </>
  );
};
