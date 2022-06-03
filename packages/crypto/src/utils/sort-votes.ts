export const sortVotes = (votes: { [vote: string]: number }) => {
    return Object.fromEntries(
        Object.entries(votes as { [vote: string]: number }).sort((a, b) => {
            if (b[1] > a[1]) {
                return 1;
            } else if (b[1] < a[1]) {
                return -1;
            } else {
                if (a[0] > b[0]) {
                    return 1;
                } else {
                    return -1;
                }
            }
        }),
    );
};
