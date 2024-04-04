import { useHMSActions } from '@100mslive/react-sdk';
import React, { useState } from 'react';

const Join = () => {
  const hmsActions = useHMSActions();
  const [inputValues, setInputValues] = useState({
    userName: 'we',
    roomCode: 'ibj-yxje-nda'
  });

  const handleInputChange = (e: any) => {
    setInputValues(prevValues => ({
      ...prevValues,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: any) => {
    console.log('clicking join');
    e.preventDefault();
    const { userName = '', roomCode = '' } = inputValues;

    // use room code to fetch auth token
    const authToken = await hmsActions.getAuthTokenByRoomCode({ roomCode });

    try {
      await hmsActions.join({
        userName,
        authToken,
        settings: {
          isAudioMuted: true,
          isVideoMuted: false
        }
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Join Room</h2>
      <div className="join-form-input">
        <label htmlFor="userName">Username</label>
        <input
          required
          value={inputValues.userName}
          onChange={handleInputChange}
          id="userName"
          type="text"
          name="userName"
          placeholder="Your name"
        />
      </div>
      <div className="join-form-input">
        <label htmlFor="room-code">Room ID</label>
        <input
          id="room-code"
          type="text"
          name="roomCode"
          placeholder="Room code"
          onChange={handleInputChange}
          value={inputValues.roomCode}
        />
      </div>
      <button className="btn-primary">Join</button>
    </form>
  );
};

export default Join;
