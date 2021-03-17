export const pythonInitializationScript = `
# ---------------- VARIABLE INSPECTOR ----------------
import json
import sys
from IPython import get_ipython
from IPython.core.magics.namespace import NamespaceMagics
from numpy import isscalar
import numpy as np


_jupyterlab_variableinspector_nms = NamespaceMagics()
_jupyterlab_variableinspector_Jupyter = get_ipython()
_jupyterlab_variableinspector_nms.shell = _jupyterlab_variableinspector_Jupyter.kernel.shell

# Convert the numpy data types to something that can be serialized in JSON
class NpEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        else:
            return super(NpEncoder, self).default(obj)


# ---------------- Multi-backend caller ----------------
def call_backend_functions(functions):
    results = {}
    for func in functions:
        func_name = func['name']
        results[func_name] = globals()[func_name](**func['parameters']) 
        
    return json.dumps(results, cls=NpEncoder)

def ed_keep_dataframes(v):
    try:
        obj = eval(v)
        # Check if datadrame
        if isinstance(obj, pd.core.frame.DataFrame):
            return True
        return False
    except:
        return False
    
def ed_keep_nondf_variables(v):
    try:
        obj = eval(v)
        # Ignore internal variables
        if v.startswith('ed_'):
            return False
        elif isinstance(obj, str):
            return True
        elif isinstance(obj, int):
            return True
        elif isinstance(obj, float):
            return True
        elif isinstance(obj, list):
            return True
        elif isscalar(obj):
            return True
        else:
            return False
    except:
        pass

def ed_keep_modules(v):
    try:
        obj = eval(v)
        # Ignore internal variables
        if getattr(obj, "__version__", None) != None:
            return True
    except:
        pass

def ed_keep_functions(v):
    try:
        obj = eval(v)
        # Check if it is a function
        # and ignore internal eigendata functions
        if callable(obj) and v[:2] != 'ed':
            return True
    except:
        pass
    
def ed_get_nondf_variables():
    values = _jupyterlab_variableinspector_nms.who_ls()
    variables = [{'name': _v,
      'type': type(eval(_v)).__name__,
      'value' : eval(_v)
     } for _v in values if ed_keep_nondf_variables(_v)]
    
    return variables

def ed_get_dfs():
    values = _jupyterlab_variableinspector_nms.who_ls()
    vararray = [_v for _v in values if ed_keep_dataframes(_v)]
    return vararray

def ed_get_imported_modules():
    return list(sys.modules.keys())

def ed_get_module_namespaces():
    values = _jupyterlab_variableinspector_nms.who_ls()
    vararray = [_v for _v in values if ed_keep_modules(_v)]
    return vararray

def ed_get_functions():
    values = _jupyterlab_variableinspector_nms.who_ls()
    vararray = [_v for _v in values if ed_keep_functions(_v)]
    return vararray

# ---------------- GET DF COLUMNS AS JSON ----------------
def ed_get_json_column_values(df):
    return json.dumps(df.columns.tolist(), ensure_ascii=False)

# ---------------- QUERYBUILDER BACKEND ----------------
from pandas.api.types import is_categorical_dtype, is_integer_dtype, is_float_dtype, is_bool_dtype, is_object_dtype
def ed_get_percentage_unique_column(df, col_name):
    return df[col_name].nunique() / df[col_name].count() * 100.0 

def ed_generate_querybuilder_config(df):
    queryprops = {}
    for i,col_type in enumerate(df.dtypes):
        col_name = df.columns[i]
        if is_integer_dtype(df[col_name]) or is_float_dtype(df[col_name]):      
            queryprops[col_name] = {
                'label' : col_name,
                'type' : 'number'
            }
        elif is_bool_dtype(df[col_name]):
            queryprops[col_name] = {
                'label' : col_name,
                'type' : 'boolean'
            }
        elif is_object_dtype(df[col_name]):
            # Categorical if less than 10% of values are unique
            if (ed_get_percentage_unique_column(df, col_name) < 10):
                queryprops[col_name] = {
                'label' : col_name,
                'type' : 'select',
                'fieldSettings' : {
                    'listValues' : [{'value': row, 'title': row} for row in df[col_name].unique() if type(row) == str]
                    }
                }
            else:
                queryprops[col_name] = {
                    'label' : col_name,
                    'type' : 'text'
                }
        elif is_categorical_dtype(df[col_name]):
            queryprops[col_name] = {
                'label' : col_name,
                'type' : 'select',
                'fieldSettings' : {
                    'listValues' : [{'value': row, 'title': row} for row in df[col_name].unique() if type(row) == str]
                    }
                }
        elif is_datetime64_any_dtype(df[col_name]):
            # Check if it contains only dates
            if ((df[col_name].dt.floor('d') == df[col_name]) | (df[col_name].isnull())).all():
                queryprops[col_name] = {
                    'label' : col_name,
                    'type' : 'date'
                }
            # Check if it contains only times
            elif ( (df[col_name].dt.date == pd.Timestamp('now').date()) | (df[col_name].isnull()) ).all():
                queryprops[col_name] = {
                    'label' : col_name,
                    'type' : 'time'
                }
            else:
                queryprops[col_name] = {
                    'label' : col_name,
                    'type' : 'datetime'
                }
            
    return json.dumps(queryprops, ensure_ascii=False)
# ---------------- DATA VISUALIZER ----------------
from pandas.api.types import is_datetime64_any_dtype,is_numeric_dtype,is_bool_dtype
def ed_build_colDefs_for_mi_cols(df):
    """
    create columnDefs dict for column grouping
    from multiindex dataframe columns
    """
    # utility
    def get_idx(s, x):
        li_headerName = [e['Header'] for e in s]
        if x not in li_headerName:
            return -1
        else:
            return li_headerName.index(x)

    mindexcol = df.columns
    li_idx_col = mindexcol.tolist()
    s = []
    for levels in li_idx_col:
        col = df.loc[:, levels]
        num_levels = len(levels)
        s2 = s
        flat_field = None
        for k, index_name in enumerate(levels):
            if flat_field:
                # Generate flat field names
                flat_field = str(flat_field) + '_' + str(index_name)
            else:
                flat_field = index_name
            # Upper levels
            if k < num_levels - 1:
                i = get_idx(s2, index_name)
                if i < 0:
                    new_index_name = {'Header': str(index_name),
                             'columns': []}
                    s2.append(new_index_name)
                    i = len(s2) - 1
                s2 = s2[i]['columns']
            # Lowest level
            else:
                flat_field = flat_field.replace('.', '_')
                new_index_name = {'accessor': flat_field,
                         'Header': str(index_name)}
                s2.append(new_index_name)
    return s

def ed_build_colDefs(df, verbose=True):
    colDefs = [{'accessor': str(col).replace('.','_'), 'Header': col} for col in df.columns]
    return colDefs


def ed_flatten_mi_col_df(dfmi):
    """
    create flattend dataframe
    multi index col ('a', 'b', 'c') turned to 'a_b_c'
    """
    df = dfmi.copy()
    cols = df.columns.map(lambda x: '_'.join([str(i) for i in x]))
    df.columns = cols
    return df

def ed_is_multiindex_col_df(df):
    if isinstance(df, pd.core.frame.DataFrame):
        if isinstance(df.columns, pd.core.indexes.multi.MultiIndex):
            return True
    return False

def ed_is_df(data):
    if isinstance(data, pd.core.frame.DataFrame):
        return True
    return False

def ed_is_multiindex_row_df(df):
    if ed_is_df(df):
        if isinstance(df.index, pd.core.indexes.multi.MultiIndex):
            return True
    return False

def ed_format_data_for_visualization(df_data):
    for col_name, col in df_data.items():
        if is_datetime64_any_dtype(col):
            # Check if it contains only dates
            if ((df_data[col_name].dt.floor('d') == df_data[col_name]) | (df_data[col_name].isnull())).all():
                df_data[col_name] =  df_data[col_name].dt.strftime('%Y-%m-%d')
            # Check if it contains only times (commented out given the default notebook diplay does not print this)
            #elif ( (df_data[col_name].dt.date == pd.Timestamp('now').date()) | (df_data[col_name].isnull()) ).all():
            #    df_data[col_name] =  df_data[col_name].dt.strftime('%H:%M:%S')
            else:
                df_data[col_name] =  df_data[col_name].dt.strftime('%Y-%m-%d %H:%M:%S')
            
            df_data[col_name] = df_data[col_name].fillna('NaT')
        # Check for bool before numeric, given booleans return tru to is_numeric
        elif is_bool_dtype(col):
            df_data[col_name] = df_data[col_name].astype('str').replace('nan','NaN')
        elif is_numeric_dtype(col):
            df_data[col_name] = df_data[col_name].fillna('NaN')
            pass
        else:
            #If not handled, treat as a string
            df_data[col_name] = df_data[col_name].astype('str').replace('nan','NaN')

def ed_prep_data_for_visualization(dfmi,index=False, sortby=None, ascending=False, page=1, page_size=30):
    """
    Prepare multiindex dataframe (data) and options
    to display it with corresponding row grouping and
    column grouping
    To do that the dataframe is modified
    + multi index columns are flattened
    + multi index rows are made regular columns
    """

    df_data = dfmi.copy()
    if sortby != None:
        df_data = df_data.sort_values(by=sortby, ascending=ascending)
    
    # Abreviations: mi is multi index

    # 1. Adjust size
    # First get real size
    n_rows =  df_data.shape[0]
    n_columns =  df_data.shape[1]
    # Hide columns for very wide dataframes
    displayed_columns = n_columns
    if n_columns > 200:
        df_data = df_data.iloc[:,:200]
        displayed_columns = 200

    # Get number of row & cols for current page
    row_start = (page-1)*page_size
    row_end = page*page_size
    df_data = df_data.iloc[row_start:row_end,:]
    
    # 2. Handle multi-level columns
    # Check it ther are multi-level columns, and generate the column definitions
    if ed_is_multiindex_col_df(df_data):
        # Build multi-level column definitions to be used by the frontend grid
        columnDefs_col = ed_build_colDefs_for_mi_cols(df_data)
        # Create a unique name for each column by composing the names of all the levels
        df_data = ed_flatten_mi_col_df(df_data)
    else:
        columnDefs_col = ed_build_colDefs(df_data)
    
    # 3. Handle multi-index rows
    if ed_is_multiindex_row_df(df_data):
        columnDefs_row = [{'accessor': str(col).replace('.','_'), 'Header': col} for col in list(df_data.index.names)]
        df_data = df_data.reset_index()
    else:
        # There is already a column named index in the dataframe
        if 'index' in df_data.columns:
            # Name the index pd_index given there is already a column named index
            columnDefs_row = [{'accessor': 'level_0', 'Header': 'pd_index'}]
            df_data = df_data.reset_index()
        # The index has a name
        elif df_data.index.name != None:
            columnDefs_row = [{'accessor': df_data.index.name, 'Header': df_data.index.name}]
            df_data = df_data.reset_index()
        # The index has no name
        else:
            columnDefs_row = [{'accessor': 'index', 'Header': 'index'}]
            df_data = df_data.reset_index()

    # 4. Get the col types before transforming
    names = [col for col in df_data.columns]
    types = [dtype.name for dtype in df_data.dtypes]
    col_types = [{'name': name, 'type': dtype} for name,dtype in zip(names,types)]

    # 5. Ensure data can be read in the frontend
    ed_format_data_for_visualization(df_data)
    # If there are any dots, remove them because react-table can't handle them
    # Only relevatn for single index columns case. 
    df_data.columns = df_data.columns.map(lambda x: str(x).replace('.','_'))
    
    # 6.Prepare output
    # Put together the columns from flattening rows and from flattinging columns
    new_columnDefs = columnDefs_row + columnDefs_col
    
    # 7. Set the json format. 
    df_data = df_data.to_dict(orient='records')
    
    result = {
        'data': df_data, 
        'columns': new_columnDefs,
        'columnTypes': col_types,
        'shape' : {
            'rows': n_rows,
            'columns': n_columns,
            'displayedColumns' : displayed_columns
        }  
    }
    
    # 3. Return as JSON
    return json.dumps(result, ensure_ascii=False, allow_nan=False)
`;
