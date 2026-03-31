import { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '../components/Layout';
import { auth } from '../firebaseConfig';

export default function Dashboard() {
    const [complaints, setComplaints] = useState([]);
    const [filter, setFilter] = useState('All');
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (user) => {
            if (!user) {
                setIsAuthenticated(false);
                setComplaints([]);
                return;
            }

            setIsAuthenticated(true);
            const token = await user.getIdToken();
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/complaints`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setComplaints(Array.isArray(data) ? data : []);
        });

        return unsubscribe;
    }, []);

    const filtered = filter === 'All' ? complaints : complaints.filter((complaint) => complaint.status === filter);

    const statusClassName = (status) => {
        if (status === 'Resolved') return 'status-pill status-pill--resolved';
        if (status === 'In Progress') return 'status-pill status-pill--progress';
        return 'status-pill status-pill--pending';
    };

    return (
        <Layout>
            <section className="surface-card">
                <div className="dashboard-head">
                    <div>
                        <div className="eyebrow">Complaint history</div>
                        <h1>Past complaints</h1>
                        <p>Review everything you have submitted and filter the list by current status.</p>
                    </div>

                    <div className="field-group">
                        <label htmlFor="status-filter">Filter by Status</label>
                        <select
                            id="status-filter"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            className="field-control"
                        >
                            <option>All</option>
                            <option>Pending</option>
                            <option>In Progress</option>
                            <option>Resolved</option>
                        </select>
                    </div>
                </div>

                {!isAuthenticated ? (
                    <div className="empty-state">
                        <p className="section-note">Sign in to view your complaint history.</p>
                        <div className="stack-actions" style={{ justifyContent: 'center' }}>
                            <Link href="/login" className="button button--primary">
                                Go to Login
                            </Link>
                        </div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="empty-state">
                        <p className="section-note">No complaints found for the selected filter yet.</p>
                    </div>
                ) : (
                    <div className="dashboard-grid">
                        {filtered.map((complaint) => (
                            <article key={complaint.id} className="complaint-card">
                                <img src={complaint.image_url} alt={complaint.type} />
                                <div className="complaint-card__body">
                                    <div className="complaint-card__meta">
                                        <strong>{complaint.type}</strong>
                                        <span className={statusClassName(complaint.status)}>{complaint.status}</span>
                                    </div>
                                    <div className="muted">{complaint.area}</div>
                                    <div className="muted">
                                        {complaint.created_at
                                            ? new Date(complaint.created_at).toLocaleString()
                                            : 'Submission time unavailable'}
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </Layout>
    );
}
