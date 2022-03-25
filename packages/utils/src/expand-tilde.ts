import { homedir } from "os";
import { join } from "path";

// https://www.ibm.com/support/knowledgecenter/en/SSVJJU_6.4.0/com.ibm.IBMDS.doc_6.4/r_cr_asciicharset.html
export const expandTilde = (path: string): string => {
    const home: string = homedir();

    if (path.charCodeAt(0) === 126) {
        if (path.charCodeAt(1) === 43) {
            return join(process.cwd(), path.slice(2));
        }

        return join(home, path.slice(1));
    }

    return path;
};
