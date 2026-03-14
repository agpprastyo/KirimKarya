export type HonoEnv = {
    Variables: {
        user: {
            id: string;
            email: string;
            name?: string;
            role?: string;
        };
        requestId: string;
    };
};
