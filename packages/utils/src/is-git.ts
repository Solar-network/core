export const isGit = (value: string): boolean =>
    new RegExp(/(?:git|ssh|https?|git@[-\w.]+):(\/\/)?(.*?)(\.git)(\/?|\#[-\d\w._]+?)$/).test(value);
