
import React from 'react';
import { Message, Role } from '../types';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === Role.USER;

  const bubbleClasses = isUser
    ? 'bg-sky-600 text-white self-end rounded-ss-2xl rounded-se-md rounded-es-2xl rounded-ee-md'
    : 'bg-gray-700 text-gray-200 self-start rounded-se-2xl rounded-ss-md rounded-ee-2xl rounded-es-md';

  const containerClasses = isUser ? 'justify-end' : 'justify-start';

  return (
    <div className={`flex w-full ${containerClasses}`}>
      <div className={`max-w-xl md:max-w-2xl px-5 py-3 my-2 shadow-md ${bubbleClasses}`}>
        <p className="text-base whitespace-pre-wrap">{message.text}</p>
      </div>
    </div>
  );
};

export default MessageBubble;
