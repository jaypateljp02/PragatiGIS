import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
                    <Card className="w-full max-w-md border-red-200 dark:border-red-900">
                        <CardHeader className="text-center">
                            <div className="flex justify-center mb-4">
                                <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
                                    <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-500" />
                                </div>
                            </div>
                            <CardTitle className="text-xl text-red-700 dark:text-red-400">Something went wrong</CardTitle>
                            <CardDescription>
                                We encountered an unexpected error.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                                {this.state.error?.message || "An unknown error occurred."}
                            </p>
                            <Button
                                className="w-full"
                                variant="default"
                                onClick={() => window.location.reload()}
                            >
                                Reload Page
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}
