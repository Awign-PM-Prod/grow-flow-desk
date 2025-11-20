-- Create deal_status_history table to track all status changes for pipeline deals
CREATE TABLE public.deal_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.pipeline_deals(id) ON DELETE CASCADE,
  sales_module_name TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deal_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view status history"
  ON public.deal_status_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert status history"
  ON public.deal_status_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_deal_status_history_deal_id ON public.deal_status_history(deal_id);
CREATE INDEX idx_deal_status_history_changed_at ON public.deal_status_history(changed_at DESC);
CREATE INDEX idx_deal_status_history_new_status ON public.deal_status_history(new_status);
CREATE INDEX idx_deal_status_history_sales_module_name ON public.deal_status_history(sales_module_name);

-- Comments for documentation
COMMENT ON TABLE public.deal_status_history IS 'Tracks all status changes for pipeline deals with timestamps';
COMMENT ON COLUMN public.deal_status_history.old_status IS 'Previous status (NULL for initial creation)';
COMMENT ON COLUMN public.deal_status_history.new_status IS 'New status after change';
COMMENT ON COLUMN public.deal_status_history.changed_at IS 'Timestamp when status change occurred';
COMMENT ON COLUMN public.deal_status_history.sales_module_name IS 'Deal name at the time of status change';

