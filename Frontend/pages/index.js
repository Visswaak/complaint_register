import Link from 'next/link';
import Layout from '../components/Layout';
import WeatherBanner from '../components/WeatherBanner';

export default function Home() {
    return (
        <Layout>
            <section className="hero">
                <div className="hero__content">
                    <div className="eyebrow">Public issue reporting platform</div>
                    <h1>Raise civic complaints with proof, status visibility, and a cleaner public workflow.</h1>
                    <p className="hero__lead">
                        Civic Connect helps residents report local problems quickly, attach evidence, and keep a
                        record of every submission in one place.
                    </p>

                    <div className="hero__actions">
                        <Link href="/attractions" className="button button--secondary">
                            Explore Attractions
                        </Link>
                        <Link href="/raise-complaint" className="button button--primary">
                            Raise Complaint
                        </Link>
                        <Link href="/dashboard" className="button button--secondary">
                            View Past Complaints
                        </Link>
                    </div>
                </div>

                <div className="hero__panel">
                    <div className="metric-card">
                        <span>Structured reporting</span>
                        <strong>Photo-backed complaints</strong>
                        <p>Upload issue images, capture location details, and submit a complete case file.</p>
                    </div>
                    <div className="metric-card">
                        <span>Complaint history</span>
                        <strong>Track every submission</strong>
                        <p>Review your previously raised complaints and filter them by current status.</p>
                    </div>
                    <div className="metric-card">
                        <span>Local awareness</span>
                        <strong>Weather alerts included</strong>
                        <p>Surface weather conditions that may influence civic incidents and response urgency.</p>
                    </div>
                </div>
            </section>

            <section id="weather" className="surface-card weather-section">
                <div className="eyebrow">Current weather</div>
                <h2>Weather update for Bangalore</h2>
                <p className="section-note">
                    Use this to check whether rain or heat conditions may affect complaint urgency and local service
                    response.
                </p>
                <WeatherBanner />
            </section>
        </Layout>
    );
}
