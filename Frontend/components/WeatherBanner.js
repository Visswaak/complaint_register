// components/WeatherBanner.js
import { useEffect, useState } from 'react';

export default function WeatherBanner() {
    const [weather, setWeather] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/weather-alert`)
            .then((res) => res.json())
            .then((data) => setWeather(data))
            .catch(() => setError(true));
    }, []);

    if (error) {
        return <div className="alert-banner">Weather service unavailable right now.</div>;
    }

    if (!weather) {
        return <div className="weather-card">Loading current weather...</div>;
    }

    return (
        <div className="weather-card">
            {weather.alert ? (
                <div className="alert-banner">Civic alert: {weather.alert} expected today. Plan for service delays.</div>
            ) : null}

            <div className="weather-card__headline">
                <div>
                    <strong>{weather.city}{weather.country ? `, ${weather.country}` : ''}</strong>
                    <p>{weather.description || weather.condition || 'Current conditions unavailable'}</p>
                </div>
                <div className="weather-card__temp">
                    {weather.temperatureC !== null ? `${Math.round(weather.temperatureC)}°C` : '--'}
                </div>
            </div>

            <div className="weather-stats">
                <div className="weather-stats__item">
                    <span>Feels like</span>
                    <strong>{weather.feelsLikeC !== null ? `${Math.round(weather.feelsLikeC)}°C` : '--'}</strong>
                </div>
                <div className="weather-stats__item">
                    <span>Humidity</span>
                    <strong>{weather.humidity !== null ? `${weather.humidity}%` : '--'}</strong>
                </div>
                <div className="weather-stats__item">
                    <span>Wind</span>
                    <strong>{weather.windSpeed !== null ? `${weather.windSpeed} m/s` : '--'}</strong>
                </div>
                <div className="weather-stats__item">
                    <span>Cloudiness</span>
                    <strong>{weather.cloudiness !== null ? `${weather.cloudiness}%` : '--'}</strong>
                </div>
            </div>

            <p className="weather-card__updated">
                Updated {weather.updatedAt ? new Date(weather.updatedAt).toLocaleTimeString() : 'recently'}
            </p>
        </div>
    );
}
