'use client';

import React from 'react';

export const DayNightBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none">
      {/* DAY ATMOSPHERE (ZainabKabira Light Mode - Warm Cream #fff9f1, Sunlight Glow, Soft Sky Mesh) */}
      <div className="absolute inset-0 transition-opacity duration-700 opacity-100 dark:opacity-0 bg-[#fff9f1]">
        {/* Warm Sunlight & Sky Radial Mesh */}
        <div className="absolute -top-32 -right-32 w-[700px] h-[700px] rounded-full bg-[rgba(255,218,63,0.22)] blur-[120px] animate-pulseGlow" />
        <div className="absolute top-1/3 -left-36 w-[600px] h-[600px] rounded-full bg-[rgba(113,183,244,0.22)] blur-[110px]" />
        <div className="absolute bottom-10 right-10 w-[500px] h-[500px] rounded-full bg-[rgba(238,232,210,0.45)] blur-[100px]" />

        {/* Floating Daylight Cloud Wisps */}
        <div className="absolute top-[7%] left-[5%] opacity-40 animate-cloud-slow">
          <svg width="260" height="80" viewBox="0 0 220 70" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M30 50C18.9543 50 10 41.0457 10 30C10 19.8643 17.5583 11.4984 27.4262 10.203C31.5435 4.14811 38.5398 0 46.5 0C57.5457 0 66.5 8.95431 66.5 20C66.5 20.9168 66.4383 21.819 66.3195 22.7037C68.4239 21.6022 70.8354 21 73.3889 21C82.563 21 90 28.437 90 37.6111C90 38.4116 89.9432 39.1989 89.8335 39.9687C91.464 39.3402 93.2372 39 95.0833 39C102.769 39 109 45.2309 109 52.9167C109 53.6219 108.948 54.3149 108.847 54.9922H30V50Z"
              fill="#eee8d2"
              fillOpacity="0.85"
            />
          </svg>
        </div>

        <div className="absolute top-[18%] right-[8%] opacity-30 animate-cloud-fast">
          <svg width="200" height="65" viewBox="0 0 180 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M20 40C12 40 5 33 5 25C5 17.5 10.5 11 18 10C21 4 27 0 34 0C43 0 50 7 50 16C54 16 58 19 58 24C58 29 54 33 49 33C51 33 65 33 75 40H20Z"
              fill="#e7dfcd"
              fillOpacity="0.75"
            />
          </svg>
        </div>
      </div>

      {/* NIGHT ATMOSPHERE (ZainabKabira Dark Mode - Deep Navy #0a0a0f, Silver Moon Glow, No Stars) */}
      <div className="absolute inset-0 transition-opacity duration-700 opacity-0 dark:opacity-100 bg-[#0a0a0f]">
        {/* Silver Moonlight & Deep Navy Radial Glow */}
        <div className="absolute -top-32 -right-32 w-[700px] h-[700px] rounded-full bg-[rgba(31,59,109,0.45)] blur-[130px] animate-pulseGlow" />
        <div className="absolute top-1/2 -left-36 w-[600px] h-[600px] rounded-full bg-[rgba(17,28,54,0.7)] blur-[110px]" />
        <div className="absolute bottom-10 right-20 w-[450px] h-[450px] rounded-full bg-[rgba(31,59,109,0.3)] blur-[100px]" />
      </div>
    </div>
  );
};


