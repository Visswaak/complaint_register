import { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '../components/Layout';
import { auth } from '../firebaseConfig';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
const ATTRACTIONS_PAGE_SIZE = 20;

export default function AttractionsPage() {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [attractions, setAttractions] = useState([]);
    const [loadingFeed, setLoadingFeed] = useState(true);
    const [savingPincode, setSavingPincode] = useState(false);
    const [postingAttraction, setPostingAttraction] = useState(false);
    const [pincode, setPincode] = useState('');
    const [attractionFile, setAttractionFile] = useState(null);
    const [attractionForm, setAttractionForm] = useState({
        title: '',
        description: '',
        exactAddress: ''
    });

    const loadProfileAndAttractions = async (activeUser) => {
        setLoadingFeed(true);

        try {
            const token = await activeUser.getIdToken();
            const profileRes = await fetch(`${API_BASE_URL}/api/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const profileData = await profileRes.json();
            setProfile(profileData);
            setPincode(profileData.pincode || '');

            if (!profileData.pincode) {
                setAttractions([]);
                return;
            }

            const attractionsRes = await fetch(`${API_BASE_URL}/api/attractions?limit=${ATTRACTIONS_PAGE_SIZE}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const attractionsData = await attractionsRes.json();
            setAttractions(Array.isArray(attractionsData.attractions) ? attractionsData.attractions : []);
        } catch (error) {
            console.error('Attractions load failed:', error);
            setAttractions([]);
        } finally {
            setLoadingFeed(false);
        }
    };

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (activeUser) => {
            setUser(activeUser);

            if (!activeUser) {
                setProfile(null);
                setAttractions([]);
                setLoadingFeed(false);
                return;
            }

            await loadProfileAndAttractions(activeUser);
        });

        return unsubscribe;
    }, []);

    const savePincode = async (e) => {
        e.preventDefault();
        if (!user) return alert('Please log in');
        if (!/^\d{6}$/.test(pincode)) return alert('Enter a valid 6 digit pincode');

        setSavingPincode(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${API_BASE_URL}/api/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ pincode })
            });

            if (!res.ok) {
                const message = await res.text();
                throw new Error(message || 'Failed to save pincode');
            }

            await loadProfileAndAttractions(user);
        } catch (error) {
            console.error('Pincode save failed:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setSavingPincode(false);
        }
    };

    const uploadImage = async (token) => {
        const sigRes = await fetch(`${API_BASE_URL}/api/upload-signature`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (!sigRes.ok) {
            const message = await sigRes.text();
            throw new Error(message || 'Failed to get upload signature');
        }

        const { timestamp, signature, apiKey } = await sigRes.json();

        const cloudForm = new FormData();
        cloudForm.append('file', attractionFile);
        cloudForm.append('api_key', apiKey);
        cloudForm.append('timestamp', timestamp);
        cloudForm.append('signature', signature);
        cloudForm.append('folder', 'civic_complaints');

        const uploadRes = await fetch(
            `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
            {
                method: 'POST',
                body: cloudForm
            }
        );

        const cloudData = await uploadRes.json();
        if (!cloudData.secure_url) throw new Error('Image upload failed');

        return cloudData.secure_url;
    };

    const createAttraction = async (e) => {
        e.preventDefault();
        if (!user) return alert('Please log in');
        if (!profile?.pincode) return alert('Set your pincode first');
        if (!attractionFile) return alert('Please choose an image');

        setPostingAttraction(true);
        try {
            const token = await user.getIdToken();
            const imageUrl = await uploadImage(token);

            const res = await fetch(`${API_BASE_URL}/api/attractions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...attractionForm,
                    imageUrl
                })
            });

            if (!res.ok) {
                const message = await res.text();
                throw new Error(message || 'Failed to create attraction');
            }

            const createdAttraction = await res.json();
            setAttractionForm({ title: '', description: '', exactAddress: '' });
            setAttractionFile(null);
            setAttractions((current) => [
                { ...createdAttraction, current_user_vote: 0 },
                ...current
            ]
                .sort((a, b) => Number(b.score) - Number(a.score) || new Date(b.created_at) - new Date(a.created_at))
                .slice(0, ATTRACTIONS_PAGE_SIZE));
        } catch (error) {
            console.error('Attraction create failed:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setPostingAttraction(false);
        }
    };

    const handleVote = async (attractionId, nextVoteValue, currentVote) => {
        if (!user) return alert('Please log in');

        try {
            const token = await user.getIdToken();
            const voteValue = currentVote === nextVoteValue ? 0 : nextVoteValue;
            const res = await fetch(`${API_BASE_URL}/api/attractions/${attractionId}/vote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ voteValue })
            });

            if (!res.ok) {
                const message = await res.text();
                throw new Error(message || 'Failed to register vote');
            }

            const voteData = await res.json();
            setAttractions((current) => [...current]
                .map((item) => item.id === attractionId ? { ...item, ...voteData } : item)
                .sort((a, b) => Number(b.score) - Number(a.score) || new Date(b.created_at) - new Date(a.created_at)));
        } catch (error) {
            console.error('Vote failed:', error);
            alert(`Error: ${error.message}`);
        }
    };

    return (
        <Layout>
            <section className="page-grid">
                <div className="surface-card">
                    <div className="eyebrow">Attractions near you</div>
                    <h1>Community-reported attractions in your pincode.</h1>
                    <p>
                        Save your pincode once, then browse and post attractions reported by people in the same area.
                        Voting works one per user, with score-sorted ranking.
                    </p>

                    {!user ? (
                        <div className="empty-state">
                            <p className="section-note">Sign in first to save your pincode, post attractions, and vote.</p>
                            <div className="stack-actions" style={{ justifyContent: 'center' }}>
                                <Link href="/login" className="button button--primary">Go to Login</Link>
                            </div>
                        </div>
                    ) : (
                        <>
                            <form onSubmit={savePincode} className="form-grid">
                                <div className="field-group">
                                    <label htmlFor="profile-pincode">Your Pincode</label>
                                    <input
                                        id="profile-pincode"
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        value={pincode}
                                        onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                                        className="field-control"
                                        placeholder="Enter 6 digit pincode"
                                        disabled={savingPincode}
                                    />
                                </div>
                                <div className="stack-actions">
                                    <button type="submit" className="button button--secondary" disabled={savingPincode}>
                                        {savingPincode ? 'Saving...' : profile?.pincode ? 'Update Pincode' : 'Save Pincode'}
                                    </button>
                                </div>
                            </form>

                            {profile?.pincode ? (
                                <form onSubmit={createAttraction} className="form-grid attraction-form">
                                    <div className="field-group">
                                        <label htmlFor="attraction-title">Attraction Title</label>
                                        <input
                                            id="attraction-title"
                                            type="text"
                                            value={attractionForm.title}
                                            onChange={(e) => setAttractionForm({ ...attractionForm, title: e.target.value })}
                                            className="field-control"
                                            required
                                            disabled={postingAttraction}
                                        />
                                    </div>
                                    <div className="field-group">
                                        <label htmlFor="attraction-description">Description</label>
                                        <textarea
                                            id="attraction-description"
                                            rows={4}
                                            value={attractionForm.description}
                                            onChange={(e) => setAttractionForm({ ...attractionForm, description: e.target.value })}
                                            className="field-control"
                                            required
                                            disabled={postingAttraction}
                                        />
                                    </div>
                                    <div className="field-group">
                                        <label htmlFor="attraction-address">Exact Address</label>
                                        <input
                                            id="attraction-address"
                                            type="text"
                                            value={attractionForm.exactAddress}
                                            onChange={(e) => setAttractionForm({ ...attractionForm, exactAddress: e.target.value })}
                                            className="field-control"
                                            required
                                            disabled={postingAttraction}
                                        />
                                    </div>
                                    <div className="field-group">
                                        <label htmlFor="attraction-photo">Photo</label>
                                        <input
                                            id="attraction-photo"
                                            type="file"
                                            className="field-control"
                                            onChange={(e) => setAttractionFile(e.target.files[0])}
                                            required
                                            disabled={postingAttraction}
                                        />
                                    </div>
                                    <div className="stack-actions">
                                        <button type="submit" className="button button--primary" disabled={postingAttraction}>
                                            {postingAttraction ? 'Posting...' : 'Post Attraction'}
                                        </button>
                                    </div>
                                </form>
                            ) : null}
                        </>
                    )}
                </div>

                <aside className="surface-card">
                    <div className="eyebrow">Local feed</div>
                    <h2>{profile?.pincode ? `Pincode ${profile.pincode}` : 'Set your pincode'}</h2>
                    <p className="section-note">
                        Attractions are limited to the same pincode and sorted by score using community votes.
                    </p>

                    {loadingFeed ? (
                        <div className="empty-state"><p className="section-note">Loading attractions...</p></div>
                    ) : !profile?.pincode ? (
                        <div className="empty-state"><p className="section-note">Save your pincode to unlock the local attractions feed.</p></div>
                    ) : attractions.length === 0 ? (
                        <div className="empty-state"><p className="section-note">No attractions reported yet for this pincode.</p></div>
                    ) : (
                        <div className="attractions-feed">
                            {attractions.map((attraction) => (
                                <article key={attraction.id} className="attraction-card">
                                    <img src={attraction.image_url} alt={attraction.title} />
                                    <div className="attraction-card__body">
                                        <div className="attraction-card__head">
                                            <strong>{attraction.title}</strong>
                                            <span className="status-pill status-pill--resolved">{attraction.pincode}</span>
                                        </div>
                                        <p className="section-note">{attraction.description}</p>
                                        <div className="muted">{attraction.exact_address}</div>
                                        <div className="attraction-votes">
                                            <button
                                                type="button"
                                                className={`vote-button${Number(attraction.current_user_vote) === 1 ? ' is-active' : ''}`}
                                                onClick={() => handleVote(attraction.id, 1, Number(attraction.current_user_vote))}
                                            >
                                                Upvote
                                            </button>
                                            <span className="vote-score">Score {attraction.score}</span>
                                            <button
                                                type="button"
                                                className={`vote-button vote-button--down${Number(attraction.current_user_vote) === -1 ? ' is-active' : ''}`}
                                                onClick={() => handleVote(attraction.id, -1, Number(attraction.current_user_vote))}
                                            >
                                                Downvote
                                            </button>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </aside>
            </section>
        </Layout>
    );
}
