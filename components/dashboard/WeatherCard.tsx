"use client";

import { useEffect, useState } from "react";

type WeatherSnapshot = {
  locationLabel: string;
  summary: string;
  currentTemperature: string;
  highTemperature: string;
  lowTemperature: string;
};

type WeatherLocation = {
  latitude: number;
  longitude: number;
  label: string;
};

const DEFAULT_WEATHER_LOCATION: WeatherLocation = {
  latitude: 37.5665,
  longitude: 126.978,
  label: "서울",
};

const WEATHER_CODE_LABELS: Record<number, string> = {
  0: "맑음",
  1: "대체로 맑음",
  2: "구름 조금",
  3: "흐림",
  45: "안개",
  48: "서리 안개",
  51: "이슬비",
  53: "약한 비",
  55: "비",
  56: "약한 어는비",
  57: "어는비",
  61: "약한 비",
  63: "비",
  65: "강한 비",
  66: "약한 어는비",
  67: "강한 어는비",
  71: "약한 눈",
  73: "눈",
  75: "강한 눈",
  77: "진눈깨비",
  80: "소나기",
  81: "강한 소나기",
  82: "매우 강한 소나기",
  85: "약한 눈 소나기",
  86: "강한 눈 소나기",
  95: "뇌우",
  96: "우박 가능",
  99: "강한 우박 가능",
};

function formatTemperature(value: unknown) {
  const parsedValue = typeof value === "number" ? value : Number(value);

  return Number.isFinite(parsedValue) ? `${Math.round(parsedValue)}°` : "-";
}

function getWeatherSummary(code: number) {
  return WEATHER_CODE_LABELS[code] ?? "날씨 확인 중";
}

function resolveWeatherLocation(): Promise<WeatherLocation> {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    return Promise.resolve(DEFAULT_WEATHER_LOCATION);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          label: "현재 위치",
        });
      },
      () => {
        resolve(DEFAULT_WEATHER_LOCATION);
      },
      {
        enableHighAccuracy: false,
        timeout: 4000,
        maximumAge: 10 * 60 * 1000,
      }
    );
  });
}

async function fetchWeatherSnapshot(signal: AbortSignal): Promise<WeatherSnapshot> {
  const location = await resolveWeatherLocation();
  const searchParams = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    current: "temperature_2m,weather_code",
    daily: "temperature_2m_max,temperature_2m_min",
    timezone: "Asia/Seoul",
    forecast_days: "1",
  });

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${searchParams.toString()}`,
    {
      method: "GET",
      cache: "no-store",
      signal,
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch weather");
  }

  const payload = (await response.json()) as {
    current?: {
      temperature_2m?: number;
      weather_code?: number;
    };
    daily?: {
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
    };
  };

  return {
    locationLabel: location.label,
    summary: getWeatherSummary(Number(payload.current?.weather_code ?? -1)),
    currentTemperature: formatTemperature(payload.current?.temperature_2m),
    highTemperature: formatTemperature(payload.daily?.temperature_2m_max?.[0]),
    lowTemperature: formatTemperature(payload.daily?.temperature_2m_min?.[0]),
  };
}

export default function WeatherCard() {
  const [snapshot, setSnapshot] = useState<WeatherSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let active = true;
    const abortController = new AbortController();

    const loadWeather = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const nextSnapshot = await fetchWeatherSnapshot(abortController.signal);

        if (!active) {
          return;
        }

        setSnapshot(nextSnapshot);
      } catch (error) {
        if (!active) {
          return;
        }

        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setErrorMessage("날씨 정보를 불러오지 못했습니다.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadWeather();

    return () => {
      active = false;
      abortController.abort();
    };
  }, [refreshToken]);

  return (
    <section className="retro-panel relative rounded-[24px] px-4 py-4 sm:rounded-[28px] sm:px-5 sm:py-4">
      <button
        type="button"
        onClick={() => setRefreshToken((currentValue) => currentValue + 1)}
        className="retro-button absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-[14px] px-0 py-0 text-sm font-semibold"
        aria-label="날씨 새로고침"
      >
        ↻
      </button>

      <div className="flex min-h-[5.5rem] flex-col items-center justify-center gap-2 text-center">
        <div className="min-w-0">
          {snapshot ? (
            <>
              <p className="theme-copy text-sm font-semibold leading-none">
                날씨 · {snapshot.locationLabel}
              </p>
              <p className="theme-heading mt-2 text-sm font-semibold leading-none">
                {snapshot.currentTemperature} · {snapshot.summary}
              </p>
              <p className="theme-copy mt-2 text-sm font-semibold leading-none">
                최고 {snapshot.highTemperature} / 최저 {snapshot.lowTemperature}
              </p>
            </>
          ) : (
            <p className="theme-copy text-sm font-semibold leading-none">
              {loading ? "날씨 불러오는 중" : errorMessage ?? "날씨 정보 없음"}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}