import { Link } from 'react-router-dom'
import { Logo } from '../components/UI'

const CONTACT = 'agencytintaa@gmail.com'
const UPDATED = '23 October 2026'

// Privacy policy and community guidelines in one page. Open to everyone (even logged out),
// because app stores and Meta's app review check that it exists. Keep it in plain words and up to date.
export default function Privacy() {
  return (
    <div className="policy">
      <header className="page-top">
        <Link to="/" aria-label="comoonly home">
          <Logo />
        </Link>
      </header>
      <h1>
        Privacy &amp;
        <br />
        community guidelines
      </h1>
      <p className="hint">Last updated {UPDATED}</p>

      <h2 className="section-title">In short</h2>
      <p>
        Comoonly helps you find small groups and events and go together. We collect only what the app needs to do that,
        we don’t sell your data, and there are no ads or trackers. You can delete your account at any time.
      </p>

      <h2 className="section-title">What we store</h2>
      <ul>
        <li>
          <strong>Your account:</strong> name and email, and your password as a one-way scrambled hash (we can’t read
          it).
        </li>
        <li>
          <strong>Your profile:</strong> city, a short line, bio and interests, as you write them.
        </li>
        <li>
          <strong>What you do in the app:</strong> groups you create, join or save, the hello you send with a request,
          group and private messages, crews, connections, blocks and reports.
        </li>
        <li>
          <strong>Events you suggest:</strong> the post link and caption. Screenshots are read once and not kept.
        </li>
        <li>
          <strong>One cookie</strong> that keeps you logged in. Nothing else is stored in your browser.
        </li>
      </ul>

      <h2 className="section-title">Who sees what</h2>
      <ul>
        <li>Your profile (not your email) is visible to people logged in to Comoonly.</li>
        <li>A group’s chat and members are visible only to its members.</li>
        <li>
          Private messages are visible only to the two of you. They’re possible only between accepted connections.
        </li>
        <li>
          Comoonly’s admins can see the list of accounts (including emails), events and reports, to keep the app safe.
        </li>
      </ul>

      <h2 className="section-title">Services we use</h2>
      <ul>
        <li>
          <strong>Google Gemini</strong> reads the event posts people suggest, to fill in the event details. Don’t put
          private information in a suggestion.
        </li>
        <li>
          <strong>Instagram</strong> (when switched on) is read only through Meta’s official API, and only public posts
          about events.
        </li>
        <li>Our hosting provider runs the server and stores the database.</li>
      </ul>

      <h2 className="section-title">How long we keep it</h2>
      <p>
        Your data stays while you have an account. Read notifications are removed after 60 days. When you delete your
        account (Me → Delete my account), your profile, messages, memberships and the groups you host are deleted
        straight away. Events you suggested stay listed, without your name.
      </p>

      <h2 className="section-title">Community guidelines</h2>
      <ul>
        <li>Be kind. Groups are small on purpose; everyone should feel welcome, especially beginners.</li>
        <li>Meet in public places, tell someone your plans, and keep exact addresses within your group.</li>
        <li>No harassment, hate, spam, scams or fake profiles.</li>
        <li>If something feels wrong, use Report and Block on the person’s profile. We read every report.</li>
      </ul>
      <p>We may remove content or accounts that break these guidelines.</p>

      <h2 className="section-title">Questions or requests</h2>
      <p>
        To ask what we hold about you, correct it, or have it deleted, email{' '}
        <a className="text-button" href={`mailto:${CONTACT}`}>
          {CONTACT}
        </a>
        .
      </p>
    </div>
  )
}
