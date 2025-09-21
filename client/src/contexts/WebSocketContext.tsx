import { createContext, useContext, useEffect, useState } from 'react';
import { useWebSocket, WebSocketMessage } from '@/hooks/useWebSocket';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface WebSocketContextType {
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  retryConnection: () => void;
  subscribe: (eventType: string, callback: (data: any) => void) => () => void;
  unsubscribe: (eventType: string, callback: (data: any) => void) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
}

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const { toast } = useToast();
  const [eventListeners, setEventListeners] = useState<Map<string, Set<(data: any) => void>>>(new Map());

  const handleMessage = (message: WebSocketMessage) => {
    const { type, data } = message;

    // Handle real-time events and invalidate appropriate queries
    switch (type) {
      case 'connection_established':
        console.log('WebSocket connection established:', data);
        break;

      case 'claim_created':
        // Invalidate all claim-related queries
        queryClient.invalidateQueries({ queryKey: ['/api/claims'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
        
        toast({
          title: "New Claim Created",
          description: `Claim #${data.claim.claimId} created by ${data.createdBy.username}`,
        });
        break;

      case 'claim_updated':
        // Invalidate claim queries
        queryClient.invalidateQueries({ queryKey: ['/api/claims'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
        
        toast({
          title: "Claim Updated",
          description: `Claim #${data.claim.claimId} updated by ${data.updatedBy.username}`,
        });
        break;

      case 'claim_approved':
        // Invalidate claim queries
        queryClient.invalidateQueries({ queryKey: ['/api/claims'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
        
        toast({
          title: "Claim Approved",
          description: `Claim #${data.claim.claimId} approved by ${data.approvedBy.username}`,
        });
        break;

      case 'claim_rejected':
        // Invalidate claim queries
        queryClient.invalidateQueries({ queryKey: ['/api/claims'] });
        queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
        
        toast({
          title: "Claim Rejected",
          description: `Claim #${data.claim.claimId} rejected by ${data.rejectedBy.username}`,
          variant: "destructive",
        });
        break;

      case 'document_ocr_started':
        // Invalidate document and OCR queries
        queryClient.invalidateQueries({ queryKey: ['/api/analytics/ocr'] });
        
        toast({
          title: "Document Processing Started",
          description: "OCR processing has begun for uploaded document",
        });
        break;

      case 'document_ocr_completed':
        // Invalidate document and OCR queries
        queryClient.invalidateQueries({ queryKey: ['/api/analytics/ocr'] });
        queryClient.invalidateQueries({ queryKey: ['/api/ocr-review'] });
        
        toast({
          title: "Document Processing Complete",
          description: `OCR processing completed with ${data.confidence}% confidence`,
        });
        break;

      case 'document_ocr_failed':
        // Invalidate document and OCR queries
        queryClient.invalidateQueries({ queryKey: ['/api/analytics/ocr'] });
        
        toast({
          title: "Document Processing Failed",
          description: "OCR processing encountered an error",
          variant: "destructive",
        });
        break;

      case 'workflow_created':
        // Invalidate workflow queries
        queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
        
        toast({
          title: "New Workflow Created",
          description: `Workflow created by ${data.createdBy.username}`,
        });
        break;

      case 'workflow_updated':
        // Invalidate workflow queries
        queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
        queryClient.invalidateQueries({ queryKey: ['/api/workflows', data.workflow.id] });
        
        if (data.updates.status) {
          toast({
            title: "Workflow Status Updated",
            description: `Workflow status changed to ${data.updates.status}`,
          });
        }
        break;

      case 'workflow_step_updated':
        // Invalidate specific workflow queries
        queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
        queryClient.invalidateQueries({ queryKey: ['/api/workflows', data.workflowId] });
        
        if (data.updates.status === 'completed') {
          toast({
            title: "Workflow Step Completed",
            description: `Step "${data.step.stepName}" completed`,
          });
        }
        break;

      case 'workflow_continued':
        // Invalidate workflow queries
        queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
        queryClient.invalidateQueries({ queryKey: ['/api/workflows', data.workflow.id] });
        
        toast({
          title: "Workflow Resumed",
          description: `Workflow continued from step "${data.fromStep}"`,
        });
        break;

      case 'workflow_transition_created':
        // Invalidate workflow queries
        queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
        queryClient.invalidateQueries({ queryKey: ['/api/workflows', data.workflowId] });
        break;

      default:
        console.log('Unhandled WebSocket event type:', type);
    }

    // Notify specific event listeners
    const listeners = eventListeners.get(type);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in WebSocket event listener:', error);
        }
      });
    }
  };

  const { isConnected, isConnecting, connectionError, retryConnection } = useWebSocket({
    onMessage: handleMessage,
    onConnect: () => {
      console.log('WebSocket connected - real-time updates active');
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected - falling back to polling');
    },
    autoReconnect: true,
    maxReconnectAttempts: 5,
    reconnectInterval: 3000
  });

  const subscribe = (eventType: string, callback: (data: any) => void) => {
    setEventListeners(prev => {
      const newMap = new Map(prev);
      const listeners = newMap.get(eventType) || new Set();
      listeners.add(callback);
      newMap.set(eventType, listeners);
      return newMap;
    });

    // Return unsubscribe function
    return () => {
      setEventListeners(prev => {
        const newMap = new Map(prev);
        const listeners = newMap.get(eventType);
        if (listeners) {
          listeners.delete(callback);
          if (listeners.size === 0) {
            newMap.delete(eventType);
          } else {
            newMap.set(eventType, listeners);
          }
        }
        return newMap;
      });
    };
  };

  const unsubscribe = (eventType: string, callback: (data: any) => void) => {
    setEventListeners(prev => {
      const newMap = new Map(prev);
      const listeners = newMap.get(eventType);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          newMap.delete(eventType);
        } else {
          newMap.set(eventType, listeners);
        }
      }
      return newMap;
    });
  };

  return (
    <WebSocketContext.Provider
      value={{
        isConnected,
        isConnecting,
        connectionError,
        retryConnection,
        subscribe,
        unsubscribe
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}