import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { auth } from '../firebaseConfig';

export default function Login() {
    const router = useRouter();

    const handleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            router.push('/dashboard');
        } catch (error) {
            console.error('Login failed:', error);
            alert('Could not log in. Check your Firebase console settings.');
        }
    };

    return (
        <Layout>
            <div className="auth-wrap">
                <section className="auth-card">
                    <div className="eyebrow">Secure access</div>
                    <h1>Sign in to manage your civic reports.</h1>
                    <p>
                        Login is required to upload complaint images, generate secure upload signatures, and view your
                        personal complaint history.
                    </p>
                    <div className="stack-actions" style={{ justifyContent: 'center' }}>
                        <button onClick={handleLogin} className="button button--primary">
                            Sign in with Google
                        </button>
                    </div>
                </section>
            </div>
        </Layout>
    );
}
