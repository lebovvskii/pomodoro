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
    if (time < 3000 && !isPaused && !isActive) {
      setTime((prev) => prev + 300);
    }
  };

  const decreaseMinutes = () => {
    if (time > 300 && !isPaused && !isActive) {
      setTime((prev) => prev - 300);
    }
  };

  const increaseSeconds = () => {
    if (time < 3000 && !isPaused && !isActive) {
      setTime((prev) => prev + 10);
    }
  };

  const decreaseSeconds = () => {
    if (time >= 10 && !isPaused && !isActive) {
      setTime((prev) => prev - 10);
    }
  };

  const { minutes, seconds } = formatTime(time);

  return (
    <>
      <div className={styles.clockContainer}>
        <div className={styles.increaseButtonsContainer}>
          <AiOutlineUp
            className={styles.increaseMinutes}
            onClick={increaseMinutes}
          />
          <AiOutlineUp
            className={styles.increaseSeconds}
            onClick={increaseSeconds}
          />
        </div>
        <div className={styles.timerWindow}>
          <span>
            {minutes < 10 ? `0${minutes}` : minutes}:
            {seconds < 10 ? `0${seconds}` : seconds}
          </span>
        </div>
        <div className={styles.decreaseButtonsContainer}>
          <AiOutlineDown
            className={styles.decreaseMinutes}
            onClick={decreaseMinutes}
          />
          <AiOutlineDown
            className={styles.decreaseSeconds}
            onClick={decreaseSeconds}
          />
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
