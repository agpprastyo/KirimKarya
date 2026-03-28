export type HonoEnv = {
    Variables: {
        user: {
            id: string;
            email: string;
            name: string;
            role?: string | null;
            image?: string | null;
            subscriptionTier?: string | null;
            emailVerified: boolean;
        };
        requestId: string;
    };
};
