import { useState } from 'react';
import Layout from '../components/Layout';
import { auth } from '../firebaseConfig';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function RaiseComplaint() {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [submitPhase, setSubmitPhase] = useState('');
    const [timings, setTimings] = useState(null);
    const [formData, setFormData] = useState({
        type: 'Drainage',
        area: 'Bellandur, Bangalore',
        description: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return alert('Please log in');
        if (!file) return alert('Please choose an image');

        setLoading(true);
        setSubmitPhase('Preparing authentication');
        setTimings(null);
        try {
            const totalStart = performance.now();

            const tokenStart = performance.now();
            const token = await user.getIdToken();
            const tokenMs = Math.round(performance.now() - tokenStart);

            setSubmitPhase('Requesting upload signature');
            const signatureStart = performance.now();
            const sigRes = await fetch(`${API_BASE_URL}/api/upload-signature`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!sigRes.ok) {
                const message = await sigRes.text();
                throw new Error(message || 'Failed to get upload signature');
            }

            const { timestamp, signature, apiKey } = await sigRes.json();
            const signatureMs = Math.round(performance.now() - signatureStart);

            const cloudForm = new FormData();
            cloudForm.append('file', file);
            cloudForm.append('api_key', apiKey);
            cloudForm.append('timestamp', timestamp);
            cloudForm.append('signature', signature);
            cloudForm.append('folder', 'civic_complaints');

            setSubmitPhase('Uploading image');
            const uploadStart = performance.now();
            const uploadRes = await fetch(
                `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
                {
                    method: 'POST',
                    body: cloudForm
                }
            );

            const cloudData = await uploadRes.json();
            if (!cloudData.secure_url) throw new Error('Image upload failed');
            const uploadMs = Math.round(performance.now() - uploadStart);

            setSubmitPhase('Saving complaint');
            const saveStart = performance.now();
            const saveRes = await fetch(`${API_BASE_URL}/api/complaints`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...formData,
                    imageUrl: cloudData.secure_url
                })
            });

            if (!saveRes.ok) {
                const message = await saveRes.text();
                throw new Error(message || 'Failed to save complaint');
            }

            const saveMs = Math.round(performance.now() - saveStart);
            const totalMs = Math.round(performance.now() - totalStart);
            const nextTimings = { tokenMs, signatureMs, uploadMs, saveMs, totalMs };

            setTimings(nextTimings);
            setSubmitPhase('Completed');
            console.table(nextTimings);

            alert('Complaint raised successfully.');
            setFile(null);
            setFormData({
                type: 'Drainage',
                area: 'Bellandur, Bangalore',
                description: ''
            });
        } catch (error) {
            console.error('Submission Error:', error);
            setSubmitPhase('Failed');
            alert(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <section className="page-grid">
                <div className="surface-card">
                    <div className="eyebrow">Raise an issue</div>
                    <h1>Submit a complete civic complaint.</h1>
                    <p>
                        Add the complaint type, affected area, a clear description, and an image. Signed-in users can
                        send reports directly to the backend and store them for follow-up.
                    </p>

                    <form onSubmit={handleSubmit} className="form-grid">
                        <div className="field-group">
                            <label htmlFor="complaint-type">Complaint Type</label>
                            <select
                                id="complaint-type"
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="field-control"
                                disabled={loading}
                            >
                                <option>Drainage</option>
                                <option>Footpath</option>
                                <option>Garbage</option>
                                <option>Streetlight</option>
                                <option>Others</option>
                            </select>
                        </div>

                        <div className="field-group">
                            <label htmlFor="complaint-image">Upload Evidence</label>
                            <input
                                id="complaint-image"
                                type="file"
                                onChange={(e) => setFile(e.target.files[0])}
                                className="field-control"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="field-group">
                            <label htmlFor="complaint-area">Area or Location</label>
                            <input
                                id="complaint-area"
                                type="text"
                                value={formData.area}
                                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                                placeholder="Area/Location"
                                className="field-control"
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="field-group">
                            <label htmlFor="complaint-description">Description</label>
                            <textarea
                                id="complaint-description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Describe the issue briefly"
                                rows={5}
                                className="field-control"
                                disabled={loading}
                            />
                        </div>

                        <div className="stack-actions">
                            <button type="submit" className="button button--primary" disabled={loading}>
                                {loading ? 'Submitting...' : 'Submit Complaint'}
                            </button>
                        </div>
                    </form>

                    {submitPhase ? (
                        <div className="timing-panel">
                            <strong>Submit Status</strong>
                            <div className="muted">{submitPhase}</div>
                            {timings ? (
                                <div className="timing-grid">
                                    <div className="timing-grid__item">
                                        <span>Token</span>
                                        <strong>{timings.tokenMs} ms</strong>
                                    </div>
                                    <div className="timing-grid__item">
                                        <span>Signature</span>
                                        <strong>{timings.signatureMs} ms</strong>
                                    </div>
                                    <div className="timing-grid__item">
                                        <span>Upload</span>
                                        <strong>{timings.uploadMs} ms</strong>
                                    </div>
                                    <div className="timing-grid__item">
                                        <span>Save</span>
                                        <strong>{timings.saveMs} ms</strong>
                                    </div>
                                    <div className="timing-grid__item timing-grid__item--total">
                                        <span>Total</span>
                                        <strong>{timings.totalMs} ms</strong>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                <aside className="surface-card">
                    <div className="eyebrow">Submission checklist</div>
                    <div className="info-list">
                        <div className="info-list__item">
                            <span>Step 1</span>
                            <strong>Sign in first</strong>
                            <p className="section-note">Firebase login is required because uploads use your auth token.</p>
                        </div>
                        <div className="info-list__item">
                            <span>Step 2</span>
                            <strong>Attach a clear image</strong>
                            <p className="section-note">Photos help confirm the issue and improve triage quality.</p>
                        </div>
                        <div className="info-list__item">
                            <span>Step 3</span>
                            <strong>Be precise about location</strong>
                            <p className="section-note">Accurate area names make routing and escalation much faster.</p>
                        </div>
                    </div>
                </aside>
            </section>
        </Layout>
    );
}
