import { extractPages } from "./functions/extractPages.js";
import { impose } from "./functions/impose.js";
import { mergePDFs } from "./functions/mergePDFs.js";
import { rotatePages } from "./functions/rotatePDF.js";
import { splitPDF } from "./functions/splitPDF.js";
import { organizeWaitOperations } from "./public/organizeWaitOperations.js";

export async function * traverseOperations(operations, input) {
    const waitOperations = organizeWaitOperations(operations);
    let results = [];
    for await (const value of nextOperation(operations, input)) {
        yield value;
    }
    return results;

    // TODO: Pult all nextOperation() in the for await, like for "extract"
    async function * nextOperation(operations, input) {
        console.log(Array.isArray(operations) && operations.length == 0);
        if(Array.isArray(operations) && operations.length == 0) { // isEmpty
            if(Array.isArray(input)) {
                console.log("operation done: " + input[0].fileName + "+");
                results = results.concat(input);
                return;
            }
            else {
                console.log("operation done: " + input.fileName);
                results.push(input);
                return;
            }
        }
    
        for (let i = 0; i < operations.length; i++) {
            for await (const value of computeOperation(operations[i], structuredClone(input))) {
                yield value;
            }
        }
    }
    
    async function * computeOperation(operation, input) {
        yield "Starting: " + operation.type;
        switch (operation.type) {
            case "done":
                console.log("Done operation will get called if all waits are done. Skipping for now.")
                break;
            case "wait":
                const waitOperation = waitOperations[operation.values.id];

                if(Array.isArray(input)) {
                    // waitOperation.input.concat(input); // May have unexpected concequences. Better throw an error for now.
                    throw new Error("Wait recieved an array as input. I don't know if this can happen, but if it does happen, I will investigate. Please share your workflow (:");
                }
                else {
                    waitOperation.input.push(input);
                }

                // Wait for all elements of previous split to finish
                if(input.splitCount && input.splitCount > 0) {
                    input.splitCount--;
                    return;
                }

                waitOperation.waitCount--;
                if(waitOperation.waitCount == 0) {
                    for await (const value of nextOperation(waitOperation.doneOperation.operations, waitOperation.input)) {
                        yield value;
                    }
                }
                break;
            case "removeObjects":
                console.warn("RemoveObjects not implemented yet.")

                if(Array.isArray(input)) {
                    for (let i = 0; i < input.length; i++) {
                        // TODO: modfiy input
                        input[i].fileName += "_removedObjects";
                        for await (const value of nextOperation(operation.operations, input[i])) {
                            yield value;
                        }
                    }
                }
                else {
                    // TODO: modfiy input
                    input.fileName += "_removedObjects";
                    for await (const value of nextOperation(operation.operations, input)) {
                        yield value;
                    }
                }
                break;
            case "extract":
                if(Array.isArray(input)) {
                    for (let i = 0; i < input.length; i++) {
                        input[i].fileName += "_extractedPages";
                        input[i].buffer = await extractPages(input[i].buffer, operation.values["pagesToExtractArray"]);
                        for await (const value of nextOperation(operation.operations, input[i])) {
                            yield value;
                        }
                    }
                }
                else {
                    input.fileName += "_extractedPages";
                    input.buffer = await extractPages(input.buffer, operation.values["pagesToExtractArray"]);
                    for await (const value of nextOperation(operation.operations, input)) {
                        yield value;
                    }
                }
                break;
            case "split":
                // TODO: When a split goes into another split function and then into a wait function it might break the done condition, as it will count multiple times.
                if(Array.isArray(input)) {
                    for (let i = 0; i < input.length; i++) {
                        const splitResult = await splitPDF(input[i].buffer, operation.values["pagesToSplitAfterArray"]);

                        const splits = [];
                        for (let j = 0; j < splitResult.length; j++) {
                            splits.push({
                                originalFileName: input[i].originalFileName,
                                fileName: input[i].fileName + "_split" + j,
                                buffer: splitResult[j],
                                splitCount: splitResult.length
                            })
                        }

                        for await (const value of nextOperation(operation.operations, splits)) {
                            yield value;
                        }
                    }
                }
                else {
                    const splitResult = await splitPDF(input.buffer, operation.values["pagesToSplitAfterArray"]);

                    const splits = [];
                    for (let j = 0; j < splitResult.length; j++) {
                        splits.push({
                            originalFileName: input.originalFileName,
                            fileName: input.fileName + "_split" + j,
                            buffer: splitResult[j],
                            splitCount: splitResult.length
                        })
                    }
                    
                    for await (const value of nextOperation(operation.operations, splits)) {
                        yield value;
                    }
                }
                break;
            case "fillField":
                console.warn("FillField not implemented yet.")

                if(Array.isArray(input)) {
                    for (let i = 0; i < input.length; i++) {
                        // TODO: modfiy input
                        input[i].fileName += "_filledField";
                        for await (const value of nextOperation(operation.operations, input[i])) {
                            yield value;
                        }
                    }
                }
                else {
                    // TODO: modfiy input
                    input.fileName += "_filledField";
                    for await (const value of nextOperation(operation.operations, input)) {
                        yield value;
                    }
                }
                break;
            case "extractImages":
                console.warn("ExtractImages not implemented yet.")

                if(Array.isArray(input)) {
                    for (let i = 0; i < input.length; i++) {
                        // TODO: modfiy input
                        input[i].fileName += "_extractedImages";
                        for await (const value of nextOperation(operation.operations, input[i])) {
                            yield value;
                        }
                    }
                }
                else {
                    // TODO: modfiy input
                    input.fileName += "_extractedImages";
                    for await (const value of nextOperation(operation.operations, input)) {
                        yield value;
                    }
                }
                break;
            case "merge":
                if(Array.isArray(input) && input.length > 1) {
                    const inputs = input;
                    input = {
                        originalFileName: inputs.map(input => input.originalFileName).join("_and_"),
                        fileName: inputs.map(input => input.fileName).join("_and_") + "_merged",
                        buffer: await mergePDFs(inputs.map(input => input.buffer))
                    }
                }
                else {
                    // Only one input, no need to merge
                    input.fileName += "_merged";
                }
                for await (const value of nextOperation(operation.operations, input)) {
                    yield value;
                }
                break;
            case "transform": {
                console.warn("Transform not implemented yet.")
                if(Array.isArray(input)) {
                    for (let i = 0; i < input.length; i++) {
                        // TODO: modfiy input
                        input[i].fileName += "_transformed";
                        for await (const value of nextOperation(operation.operations, input[i])) {
                            yield value;
                        }
                    }
                }
                else {
                    // TODO: modfiy input
                    input.fileName += "_transformed";
                    for await (const value of nextOperation(operation.operations, input)) {
                        yield value;
                    }
                }
                break;
            }
            case "extract":
                if(Array.isArray(input)) {
                    for (let i = 0; i < input.length; i++) {
                        input[i].fileName += "_extractedPages";
                        input[i].buffer = await extractPages(input[i].buffer, operation.values["pagesToExtractArray"]);
                        for await (const value of nextOperation(operation.operations, input[i])) {
                            yield value;
                        }
                    }
                }
                else {
                    input.fileName += "_extractedPages";
                    input.buffer = await extractPages(input.buffer, operation.values["pagesToExtractArray"]);
                    for await (const value of nextOperation(operation.operations, input)) {
                        yield value;
                    }
                }
                break;
            case "rotate":
                if(Array.isArray(input)) {
                    for (let i = 0; i < input.length; i++) {
                        input[i].fileName += "_turned";
                        input[i].buffer = await rotatePages(input[i].buffer, operation.values["rotation"]);
                        for await (const value of nextOperation(operation.operations, input[i])) {
                            yield value;
                        }
                    }
                }
                else {
                    input.fileName += "_turned";
                    input.buffer = await rotatePages(input.buffer, operation.values["rotation"]);
                    for await (const value of nextOperation(operation.operations, input)) {
                        yield value;
                    }
                }
                break;
            case "impose":
                if(Array.isArray(input)) {
                    for (let i = 0; i < input.length; i++) {
                        input[i].fileName += "_imposed";
                        input[i].buffer = await impose(input[i].buffer, operation.values["nup"], operation.values["format"]);
                        for await (const value of nextOperation(operation.operations, input[i])) {
                            yield value;
                        }
                    }
                }
                else {
                    input.fileName += "_imposed";
                    input.buffer = await impose(input.buffer, operation.values["nup"], operation.values["format"]);
                    for await (const value of nextOperation(operation.operations, input)) {
                        yield value;
                    }
                }
                break;
            default:
                console.log("operation type unknown: ", operation.type);
                break;
        }
    }
}