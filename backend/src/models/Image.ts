import mongoose,{Schema} from "mongoose";
import type {IImageDocument} from "../interface/interface.js";

const ImageSchema = new Schema({
    url: { type: String, required: true, unique: true },
    pageUrl: { type: String, required: true },
    className: { type: String, required: true },
    totalMatches: { type: Number, required: true },
    isUnique: { type: Boolean, required: true },
    domains: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now }
});


export const ImageModel = mongoose.model<IImageDocument>('Image', ImageSchema);