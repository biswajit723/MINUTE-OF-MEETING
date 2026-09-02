'use client';

import React, { useState } from 'react';
import './style.css';

export default function App() {
  const [message, setMessage] = useState('');

  function testWebsite() {
    setMessage('MOM Meeting Hub successfully working!');
  }

  return (
    <div className="website">
      <div className="background-effect effect-one"></div>
      <div className="background-effect effect-two"></div>

      <header className="header">
        <div>
          <p className="small-heading">MOM MEETING HUB</p>

          <h1>
            Meet. Decide.
            <span> Deliver.</span>
          </h1>

          <p className="description">
            Create date-wise TBMs, add Information and Action points, and keep
            every team member connected.
          </p>
        </div>

        <button className="create-button" onClick={testWebsite}>
          + Create New TBM
        </button>
      </header>

      {message && <div className="success-message">{message}</div>}

      <section className="dashboard-cards">
        <div className="dashboard-card">
          <p>TOTAL TBMS</p>
          <h2>1</h2>
        </div>

        <div className="dashboard-card">
          <p>ALL POINTS</p>
          <h2>2</h2>
        </div>

        <div className="dashboard-card">
          <p>OPEN ACTIONS</p>
          <h2>1</h2>
        </div>

        <div className="dashboard-card">
          <p>TEAM ACCESS</p>
          <h2 className="live-text">LIVE</h2>
        </div>
      </section>

      <section className="meeting-section">
        <aside className="timeline-card">
          <div className="section-title">
            <h2>TBM Timeline</h2>
            <span>Date-wise</span>
          </div>

          <input
            className="search-box"
            type="text"
            placeholder="Search TBM or date"
          />

          <button className="meeting-list-item active-meeting">
            <strong>TBM-1</strong>
            <small>02 September 2026</small>
            <small>2 total points</small>
          </button>
        </aside>

        <main className="meeting-card">
          <div className="meeting-header">
            <div>
              <h2>TBM-1</h2>
              <p>📅 02 September 2026</p>
            </div>

            <button className="add-button">+ Add Point</button>
          </div>

          <div className="meeting-tabs">
            <button className="information-tab">INFORMATION</button>

            <button className="action-tab">ACTION</button>
          </div>

          <div className="information-point">
            <div className="point-number">1</div>

            <div>
              <p>Weekly safety briefing completed.</p>
              <small>Added by Biswajit Ghosh • 10:15 AM</small>
            </div>
          </div>
        </main>
      </section>
    </div>
  );
}
