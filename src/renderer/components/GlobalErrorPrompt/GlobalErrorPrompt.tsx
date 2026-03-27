import React, { useEffect } from 'react';
import { App } from 'antd';
import { GlobalErrorPayload } from '../../utils/errorBus';

const isBenignCancellation = (error: unknown): boolean => {
  if (!error) {
    return false;
  }

  if (typeof error === 'string') {
    return error.toLowerCase().includes('operation is manually canceled');
  }

  if (error instanceof Error) {
    return error.message.toLowerCase().includes('operation is manually canceled');
  }

  if (typeof error === 'object') {
    const maybeType = 'type' in error ? error.type : undefined;
    const maybeMsg = 'msg' in error ? error.msg : 'message' in error ? error.message : undefined;
    return (
      (maybeType === 'cancelation' || maybeType === 'cancellation') &&
      typeof maybeMsg === 'string' &&
      maybeMsg.toLowerCase().includes('operation is manually canceled')
    );
  }

  return false;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const maybeMessage = 'message' in error ? error.message : undefined;
    if (typeof maybeMessage === 'string' && maybeMessage.trim()) {
      return maybeMessage;
    }

    const maybeErrorFields = 'errorFields' in error ? error.errorFields : undefined;
    if (Array.isArray(maybeErrorFields) && maybeErrorFields.length > 0) {
      return maybeErrorFields
        .flatMap((field) => {
          if (!field || typeof field !== 'object' || !('errors' in field)) {
            return [];
          }
          return Array.isArray(field.errors)
            ? field.errors.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
            : [];
        })
        .join('\n');
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
};

const GlobalErrorPrompt: React.FC = () => {
  const { notification } = App.useApp();

  useEffect(() => {
    const handleGlobalError = (event: Event) => {
      const customEvent = event as CustomEvent<GlobalErrorPayload>;
      const { title, message, type } = customEvent.detail;

      notification.error({
        title,
        description: message,
        placement: 'topRight',
        duration: type === 'network' ? 5 : 8,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isBenignCancellation(event.reason)) {
        event.preventDefault();
        return;
      }

      const errorMsg = getErrorMessage(event.reason);
      let title = 'Unhandled Error';

      if (errorMsg.toLowerCase().includes('network') || errorMsg.toLowerCase().includes('fetch')) {
        title = 'Network Exception';
      } else if (errorMsg.toLowerCase().includes('syntax') || errorMsg.toLowerCase().includes('sql')) {
        title = 'SQL Syntax Error';
      } else if (errorMsg.toLowerCase().includes('connect') || errorMsg.toLowerCase().includes('login') || errorMsg.toLowerCase().includes('econnrefused')) {
        title = 'Database Connection Failed';
      }

      notification.error({
        title,
        description: errorMsg,
        placement: 'topRight',
      });
      event.preventDefault();
    };

    window.addEventListener('global-error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('global-error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [notification]);

  return null;
};

export default GlobalErrorPrompt;
