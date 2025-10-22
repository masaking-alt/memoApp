import React, { useState } from 'react';
import './App.css';

function App() {
  const [memos, setMemos] = useState([]);

  const handleAddMemo = () => {
    setMemos([...memos, '']);
  };

  const handleMemoChange = (index, value) => {
    const newMemos = [...memos];
    newMemos[index] = value;
    setMemos(newMemos);
  };

  const handleRemoveMemo = (index) => {
    const newMemos = memos.filter((_, i) => i !== index);
    setMemos(newMemos);
  };

  return (
    <div className="container">
      <div className="App">
        <header className="App-header">
          <h1>Memo Pad</h1>
          <button onClick={handleAddMemo}>Add Memo</button>
          <ul className="memo-list">
            {memos.map((memo, index) => (
              <li key={index}>
                <textarea
                  value={memo}
                  onChange={(e) => handleMemoChange(index, e.target.value)}
                />
                <button onClick={() => handleRemoveMemo(index)}>×</button>
              </li>
            ))}
          </ul>
        </header>
        <footer>
          <p dangerouslySetInnerHTML={{ __html: '&copy; <a href="https://masaking.pages.dev/" target="_blank" rel="noopener noreferrer">masaking</a>' }} />
        </footer>
      </div>
    </div>
  );

}

export default App;