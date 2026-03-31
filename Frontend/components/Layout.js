import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { auth } from '../firebaseConfig';

const navItems = [
    { href: '/', label: 'Home' },
    { href: '/#weather', label: 'Weather' },
    { href: '/attractions', label: 'Attractions' },
    { href: '/raise-complaint', label: 'Raise Complaint' },
    { href: '/dashboard', label: 'Past Complaints' }
];

export default function Layout({ children }) {
    const router = useRouter();
    const [user, setUser] = useState(null);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(setUser);
        return unsubscribe;
    }, []);

    return (
        <div className="app-shell">
            <div className="page-glow page-glow-left" />
            <div className="page-glow page-glow-right" />
            <header className="site-header">
                <div className="site-header__inner">
                    <Link href="/" className="brand-mark">
                        <span className="brand-mark__badge">CC</span>
                        <span>
                            <strong>Civic Connect</strong>
                            <small>City issues, tracked properly</small>
                        </span>
                    </Link>

                    <nav className="site-nav" aria-label="Primary">
                        {navItems.map((item) => {
                            const isActive = item.href === '/'
                                ? router.pathname === '/'
                                : item.href.startsWith('/#')
                                    ? false
                                    : router.pathname === item.href;

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`site-nav__link${isActive ? ' is-active' : ''}`}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="site-header__auth">
                        {user ? <span className="user-chip">{user.displayName || user.email}</span> : null}
                        <Link href="/login" className="button button--nav">
                            {user ? 'Account' : 'Login'}
                        </Link>
                    </div>
                </div>
            </header>

            <main className="page-content">{children}</main>
        </div>
    );
}
