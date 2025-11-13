-- Add missing status-based fields to pipeline_deals table
-- This migration adds fields for file uploads and status change requirements

-- Add discovery_meeting_slides for Pre-Appointment Prep Done status
ALTER TABLE public.pipeline_deals 
ADD COLUMN IF NOT EXISTS discovery_meeting_slides TEXT;

-- Add final_proposal_slides for Final Proposal Done status
ALTER TABLE public.pipeline_deals 
ADD COLUMN IF NOT EXISTS final_proposal_slides TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.pipeline_deals.discovery_meeting_slides IS 'File URL or attachment path for Pre-Appointment Prep Done status (Optional)';
COMMENT ON COLUMN public.pipeline_deals.final_proposal_slides IS 'File URL or attachment path for Final Proposal Done status (Mandatory)';

