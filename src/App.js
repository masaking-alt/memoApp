import React, { useState } from 'react';
import './App.css';

function App() {
  const [memos, setMemos] = useState([]);
  const [currentMemo, setCurrentMemo] = useState('');

  const handleAddMemo = () => {
    if (currentMemo.trim() !== '') {
      setMemos([...memos, currentMemo]);
      setCurrentMemo('');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Simple Memo Pad</h1>
        <div className="memo-input">
          <input
            type="text"
            value={currentMemo}
            onChange={(e) => setCurrentMemo(e.target.value)}
            placeholder="Enter a new memo"
          />
          <button onClick={handleAddMemo}>Add Memo</button>
        </div>
        <ul className="memo-list">
          {memos.map((memo, index) => (
            <li key={index}>{memo}</li>
          ))}
        </ul>
      </header>
    </div>
  );
}

export default App;